import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { envs } from '../config/envs';
import { SendEmailCustomService } from '../common/services/send-email.service';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
const archiver = require('archiver');
import { google } from 'googleapis';

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);

  constructor(private readonly emailService: SendEmailCustomService) {}

  @Cron('0 3 * * *', {
    name: 'automated_database_backup',
    timeZone: 'America/Bogota', // Ajusta según tu zona horaria
  })
  async handleCron() {
    this.logger.log('Iniciando proceso de backup automático...');
    await this.ejecutarBackup();
  }

  async ejecutarBackup(): Promise<void> {
    const timestamp = this.getTimestamp();
    const zipFilePath = path.join(process.cwd(), 'backups', `backup_${timestamp}.zip`);
    
    let isSuccess = false;
    let errorMessage = '';
    let backupStats = { collections: 0, docs: 0, size: '0 MB' };
    let backupDir = '';

    try {
      // 1. Extraer datos de MongoDB usando el script de npm en un proceso hijo para evitar desbordar la RAM
      this.logger.log('Extrayendo datos de MongoDB mediante child process...');
      await this.runBackupScript();

      // Buscar cuál fue el directorio generado
      backupDir = this.getLatestBackupDir();
      
      const resumen = this.readResumen(backupDir);
      backupStats = {
        collections: resumen.colecciones?.length || 0,
        docs: resumen.totalDocumentos || 0,
        size: resumen.totalTamaño || '0 MB'
      };

      // 2. Comprimir a ZIP
      this.logger.log('Comprimiendo datos a ZIP...');
      await this.comprimirDirectorio(backupDir, zipFilePath);

      // 3. Subir a Google Drive
      this.logger.log('Subiendo a Google Drive...');
      await this.subirADrive(zipFilePath, `backup_${timestamp}.zip`);

      // 4. Aplicar política de retención (7 días)
      this.logger.log('Aplicando política de retención en Drive...');
      await this.limpiarBackupsAntiguosDrive();

      isSuccess = true;
      this.logger.log('Backup completado con éxito.');
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error durante el backup: ${msg}`, stack);
      errorMessage = msg;
    } finally {
      // 5. Limpiar archivos locales (JSONs y ZIP)
      this.logger.log('Limpiando archivos temporales locales...');
      if (backupDir) this.limpiarDirectorioLocal(backupDir);
      if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath);

      // 6. Enviar notificación por correo
      await this.enviarNotificacion(isSuccess, timestamp, errorMessage, backupStats);
    }
  }

  private getTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  }

  private runBackupScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const exec = require('child_process').exec;
      exec('npm run backup:db', (error: any, stdout: string, stderr: string) => {
        if (error) {
          this.logger.error(`Error en script de backup: ${stderr}`);
          reject(error);
        } else {
          this.logger.log(`Script de backup completado: ${stdout}`);
          resolve();
        }
      });
    });
  }

  private getLatestBackupDir(): string {
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) throw new Error('No se encontró el directorio de backups');
    const dirs = fs.readdirSync(backupsDir).filter(f => fs.statSync(path.join(backupsDir, f)).isDirectory());
    if (dirs.length === 0) throw new Error('No hay subdirectorios en backups/');
    
    // Sort by name (timestamp) descending
    dirs.sort((a, b) => b.localeCompare(a));
    return path.join(backupsDir, dirs[0]);
  }

  private readResumen(backupDir: string): any {
    const resumenPath = path.join(backupDir, '_resumen.json');
    if (fs.existsSync(resumenPath)) {
      const content = fs.readFileSync(resumenPath, 'utf-8');
      return JSON.parse(content);
    }
    return { collections: 0, docs: 0, size: '0 MB' };
  }

  private comprimirDirectorio(sourceDir: string, outPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  private getDriveAuth() {
    const oauth2Client = new google.auth.OAuth2(
      envs.googleGmailClientId,
      envs.googleGmailClientSecret,
    );
    oauth2Client.setCredentials({ refresh_token: envs.googleGmailRefreshToken });
    return oauth2Client;
  }

  private async subirADrive(filePath: string, fileName: string): Promise<void> {
    const drive = google.drive({ version: 'v3', auth: this.getDriveAuth() });
    
    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [envs.googleDriveFolderId],
      },
      media: {
        mimeType: 'application/zip',
        body: fs.createReadStream(filePath),
      },
    });
  }

  private async limpiarBackupsAntiguosDrive(): Promise<void> {
    const drive = google.drive({ version: 'v3', auth: this.getDriveAuth() });
    
    // Calcular fecha hace 7 días
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 7);
    
    // Buscar archivos en la carpeta de backups más antiguos que la fecha límite
    const res = await drive.files.list({
      q: `'${envs.googleDriveFolderId}' in parents and createdTime < '${fechaLimite.toISOString()}'`,
      fields: 'files(id, name, createdTime)',
    });

    const filesToDelete = res.data.files || [];
    
    for (const file of filesToDelete) {
      this.logger.log(`Eliminando backup antiguo de Drive: ${file.name}`);
      await drive.files.delete({ fileId: file.id! });
    }
  }

  private limpiarDirectorioLocal(dir: string): void {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  private async enviarNotificacion(isSuccess: boolean, timestamp: string, errorMessage: string, stats: any): Promise<void> {
    const emailTo = envs.backupNotificationEmail;
    if (!emailTo) return;

    const subject = isSuccess 
      ? `Backup Exitoso de MongoDB - Agencias API (${timestamp})`
      : `❌ ALERTA: Fallo en Backup de MongoDB - Agencias API (${timestamp})`;

    let html = `<h2>Reporte de Backup Automático</h2>`;
    html += `<p><strong>Fecha/Hora:</strong> ${timestamp}</p>`;
    
    if (isSuccess) {
      html += `<p style="color: green;"><strong>Estado:</strong> Completado Exitosamente</p>`;
      html += `<h3>Estadísticas:</h3>`;
      html += `<ul>
        <li><strong>Colecciones exportadas:</strong> ${stats.collections}</li>
        <li><strong>Total documentos:</strong> ${stats.docs.toLocaleString()}</li>
        <li><strong>Tamaño JSON original:</strong> ${stats.size}</li>
      </ul>`;
      html += `<p>El archivo comprimido ha sido guardado exitosamente en Google Drive.</p>`;
    } else {
      html += `<p style="color: red;"><strong>Estado:</strong> FALLIDO</p>`;
      html += `<h3>Detalle del Error:</h3>`;
      html += `<p><code>${errorMessage}</code></p>`;
      html += `<p>Por favor revise los logs del servidor para más detalles.</p>`;
    }

    try {
      // Como SendEmailCustomService es un poco específico con su implementación RFC 2822 y depende de auth de Gmail
      // Podrías usar un método público genérico si existe, o usar Nodemailer directo si SendEmailCustomService no es fácil de consumir.
      // Pero asumiendo que tienes un método enviar() o puedes adaptarlo:
      
      await this.emailService.sendEmail(emailTo, subject, html);
      
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`No se pudo enviar el correo de notificación: ${msg}`);
    }
  }
}
