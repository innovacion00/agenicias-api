/* eslint-disable @typescript-eslint/no-var-requires */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';

dotenv.config();

// Usamos require para evitar conflictos de tipos con @types/archiver en ts-node
// eslint-disable-next-line
const createArchive = require('archiver') as (format: string, opts?: any) => any;

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!;
const CLIENT_ID = process.env.GOOGLE_GMAIL_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_GMAIL_CLIENT_SECRET!;
const REFRESH_TOKEN = process.env.GOOGLE_GMAIL_REFRESH_TOKEN!;
const SENDER_EMAIL = process.env.SENDER_EMAIL!;
const NOTIFICATION_EMAIL = process.env.BACKUP_NOTIFICATION_EMAIL || 'innovacion@gehsuites.com';

function getLatestBackupDir(): string {
  const backupsDir = path.join(process.cwd(), 'backups');
  const dirs = fs.readdirSync(backupsDir)
    .filter(f => fs.statSync(path.join(backupsDir, f)).isDirectory())
    .sort((a, b) => b.localeCompare(a));
  if (!dirs.length) throw new Error('No se encontró directorio de backup');
  return path.join(backupsDir, dirs[0]);
}

function comprimirDirectorio(sourceDir: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process') as typeof import('child_process');
    // Compress-Archive de PowerShell nativo en Windows
    const cmd = `powershell -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${outPath}' -Force"`;
    exec(cmd, (error, _stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve();
    });
  });
}

async function subirADrive(filePath: string, fileName: string): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [DRIVE_FOLDER_ID],
    },
    media: {
      mimeType: 'application/zip',
      body: fs.createReadStream(filePath),
    },
    fields: 'id, name',
  });
  return res.data.id!;
}

async function limpiarBackupsAntiguosDrive(): Promise<number> {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 7);

  const res = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and createdTime < '${fechaLimite.toISOString()}' and trashed = false`,
    fields: 'files(id, name, createdTime)',
  });

  const toDelete = res.data.files || [];
  for (const file of toDelete) {
    console.log(`🗑️  Eliminando backup antiguo: ${file.name}`);
    await drive.files.delete({ fileId: file.id! });
  }
  return toDelete.length;
}

async function enviarCorreo(success: boolean, stats: any, timestamp: string, errorMsg = '') {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const subject = success
    ? `✅ Backup Exitoso de MongoDB - Agencias API (${timestamp})`
    : `❌ ALERTA: Fallo en Backup de MongoDB - Agencias API (${timestamp})`;

  let html = `<h2>Reporte de Backup Automático</h2><p><strong>Fecha/Hora:</strong> ${timestamp}</p>`;
  if (success) {
    html += `<p style="color:green"><strong>Estado:</strong> Completado Exitosamente ✅</p>
    <h3>Estadísticas:</h3>
    <ul>
      <li><strong>Colecciones exportadas:</strong> ${stats.colecciones}</li>
      <li><strong>Total documentos:</strong> ${Number(stats.documentos).toLocaleString()}</li>
      <li><strong>Tamaño total JSON:</strong> ${stats.tamaño}</li>
    </ul>
    <p>El archivo comprimido fue guardado exitosamente en Google Drive.</p>`;
  } else {
    html += `<p style="color:red"><strong>Estado:</strong> FALLIDO ❌</p>
    <h3>Error:</h3><p><code>${errorMsg}</code></p>`;
  }

  // Construir mensaje RFC 2822
  const messageParts = [
    `From: ${SENDER_EMAIL}`,
    `To: ${NOTIFICATION_EMAIL}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ];
  const rawMessage = messageParts.join('\n');
  const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage },
  });
}

async function main() {
  const timestamp = new Date().toISOString().replace('T', '_').slice(0, 16).replace(':', '-');
  let backupDir = '';
  let zipPath = '';

  try {
    // 1. Obtener el último backup generado
    backupDir = getLatestBackupDir();
    const resumenPath = path.join(backupDir, '_resumen.json');
    const resumen = JSON.parse(fs.readFileSync(resumenPath, 'utf-8'));
    const stats = {
      colecciones: resumen.colecciones.length,
      documentos: resumen.totalDocumentos,
      tamaño: resumen.totalTamaño,
    };

    const backupName = path.basename(backupDir);
    zipPath = path.join(process.cwd(), 'backups', `backup_${backupName}.zip`);

    // 2. Comprimir
    console.log('🗜️  Comprimiendo backup...');
    await comprimirDirectorio(backupDir, zipPath);
    const zipSize = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
    console.log(`✅ ZIP creado: ${zipSize} MB`);

    // 3. Subir a Drive
    console.log('☁️  Subiendo a Google Drive...');
    const fileId = await subirADrive(zipPath, `backup_${backupName}.zip`);
    console.log(`✅ Subido a Drive (ID: ${fileId})`);

    // 4. Retención
    console.log('🧹 Aplicando política de retención (7 días)...');
    const deleted = await limpiarBackupsAntiguosDrive();
    console.log(`✅ ${deleted} backups antiguos eliminados de Drive`);

    // 5. Correo de éxito
    console.log(`📧 Enviando correo a ${NOTIFICATION_EMAIL}...`);
    await enviarCorreo(true, stats, backupName);
    console.log('✅ Correo enviado');

    // 6. Limpiar directorio local
    fs.rmSync(backupDir, { recursive: true, force: true });
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    console.log('✅ Archivos temporales locales eliminados');

    console.log('\n🎉 ¡Proceso completo! Backup finalizado exitosamente.\n');
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    // Intentar enviar correo de fallo
    try { await enviarCorreo(false, {}, timestamp, err.message); } catch {}
    // Limpiar
    if (backupDir && fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true });
    if (zipPath && fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    process.exit(1);
  }
}

main();
