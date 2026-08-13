/**
 * Script de Backup Completo - Agencias API
 *
 * Ejecuta el flujo completo de backup:
 *   1. Exporta las colecciones de MongoDB a JSON (excluye refreshtokens y otpverifications)
 *   2. Comprime los archivos a un ZIP
 *   3. Sube el ZIP a Google Drive
 *   4. Aplica política de retención (elimina backups > 7 días en Drive)
 *   5. Limpia archivos temporales locales
 *   6. Envía notificación por correo a innovacion@gehsuites.com
 *
 * Uso:
 *   npm run backup:full
 *
 * Variables de entorno requeridas (.env):
 *   MONGO_URL, SENDER_EMAIL,
 *   GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, GOOGLE_GMAIL_REFRESH_TOKEN,
 *   GOOGLE_DRIVE_FOLDER_ID, BACKUP_NOTIFICATION_EMAIL
 */

/* eslint-disable @typescript-eslint/no-var-requires */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { google } from 'googleapis';

dotenv.config();

// ─── Configuración ────────────────────────────────────────────────────────────

const MONGO_URL            = process.env.MONGO_URL!;
const CLIENT_ID            = process.env.GOOGLE_GMAIL_CLIENT_ID!;
const CLIENT_SECRET        = process.env.GOOGLE_GMAIL_CLIENT_SECRET!;
const REFRESH_TOKEN        = process.env.GOOGLE_GMAIL_REFRESH_TOKEN!;
const SENDER_EMAIL         = process.env.SENDER_EMAIL!;
const DRIVE_FOLDER_ID      = process.env.GOOGLE_DRIVE_FOLDER_ID!;
const NOTIFICATION_EMAIL   = process.env.BACKUP_NOTIFICATION_EMAIL || 'innovacion@gehsuites.com';
const RETENTION_DAYS       = 7;

// Colecciones que NO se incluyen en el backup (datos de un solo uso / temporales)
const SKIP_COLLECTIONS = ['refreshtokens', 'otpverifications'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getOAuth2Client() {
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  auth.setCredentials({ refresh_token: REFRESH_TOKEN });
  return auth;
}

// ─── Paso 1: Exportar MongoDB ──────────────────────────────────────────────────

interface BackupStats {
  colecciones: number;
  documentos: number;
  tamano: string;
}

async function exportarMongo(backupDir: string): Promise<BackupStats> {
  console.log('🔌 Conectando a MongoDB...');
  await mongoose.connect(MONGO_URL);
  console.log('✅ Conectado\n');

  const db = mongoose.connection.db;
  if (!db) throw new Error('No se pudo conectar a la base de datos');

  const collections = await db.listCollections().toArray();
  let totalDocs = 0;
  let totalBytes = 0;
  let exportedCols = 0;

  for (const colInfo of collections) {
    const colName = colInfo.name;

    if (SKIP_COLLECTIONS.includes(colName)) {
      console.log(`  ⏭️  Saltando "${colName}" (excluida del backup)`);
      continue;
    }

    process.stdout.write(`  📦 Exportando "${colName}"... `);
    const col = db.collection(colName);
    const docs = await col.find({}).toArray();
    const jsonContent = JSON.stringify(docs, null, 2);
    fs.writeFileSync(path.join(backupDir, `${colName}.json`), jsonContent, 'utf-8');
    const colBytes = Buffer.byteLength(jsonContent, 'utf-8');
    console.log(`${docs.length.toLocaleString()} documentos (${formatBytes(colBytes)})`);
    totalDocs += docs.length;
    totalBytes += colBytes;
    exportedCols++;
  }

  await mongoose.disconnect();
  return { colecciones: exportedCols, documentos: totalDocs, tamano: formatBytes(totalBytes) };
}

// ─── Paso 2: Comprimir a ZIP ───────────────────────────────────────────────────

function comprimirDirectorio(sourceDir: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process') as typeof import('child_process');
    const cmd = `powershell -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${outPath}' -Force"`;
    exec(cmd, (error, _stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve();
    });
  });
}

// ─── Paso 3: Subir a Google Drive ─────────────────────────────────────────────

async function subirADrive(filePath: string, fileName: string): Promise<string> {
  const drive = google.drive({ version: 'v3', auth: getOAuth2Client() });
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [DRIVE_FOLDER_ID] },
    media: { mimeType: 'application/zip', body: fs.createReadStream(filePath) },
    fields: 'id, name',
  });
  return res.data.id!;
}

// ─── Paso 4: Retención (eliminar backups > 7 días) ────────────────────────────

async function limpiarBackupsAntiguos(): Promise<number> {
  const drive = google.drive({ version: 'v3', auth: getOAuth2Client() });
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - RETENTION_DAYS);

  const res = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and createdTime < '${fechaLimite.toISOString()}' and trashed = false`,
    fields: 'files(id, name)',
  });

  const toDelete = res.data.files || [];
  for (const file of toDelete) {
    console.log(`  🗑️  Eliminando backup antiguo: ${file.name}`);
    await drive.files.delete({ fileId: file.id! });
  }
  return toDelete.length;
}

// ─── Paso 5: Notificación por correo ──────────────────────────────────────────

async function enviarCorreo(
  success: boolean,
  timestamp: string,
  stats?: BackupStats,
  errorMsg = '',
): Promise<void> {
  const gmail = google.gmail({ version: 'v1', auth: getOAuth2Client() });

  const subject = success
    ? `Backup Exitoso de MongoDB - Agencias API (${timestamp})`
    : `❌ ALERTA: Fallo en Backup de MongoDB - Agencias API (${timestamp})`;

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">🗄️ Reporte de Backup Automático</h2>
      <p><strong>Fecha/Hora:</strong> ${timestamp}</p>
  `;

  if (success && stats) {
    html += `
      <p style="color: #28a745; font-size: 16px;"><strong>Estado:</strong> ✅ Completado Exitosamente</p>
      <h3>Estadísticas del Backup:</h3>
      <table style="border-collapse: collapse; width: 100%;">
        <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><strong>Colecciones exportadas</strong></td><td style="padding:8px;border:1px solid #ddd;">${stats.colecciones}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Total documentos</strong></td><td style="padding:8px;border:1px solid #ddd;">${stats.documentos.toLocaleString()}</td></tr>
        <tr style="background:#f5f5f5;"><td style="padding:8px;border:1px solid #ddd;"><strong>Tamaño JSON original</strong></td><td style="padding:8px;border:1px solid #ddd;">${stats.tamano}</td></tr>
      </table>
      <p style="color:#666; font-size:12px; margin-top:16px;">Colecciones excluidas: ${SKIP_COLLECTIONS.join(', ')} (datos temporales de un solo uso)</p>
      <p>☁️ El archivo comprimido fue guardado exitosamente en <strong>Google Drive</strong>.</p>
    `;
  } else {
    html += `
      <p style="color: #dc3545; font-size: 16px;"><strong>Estado:</strong> ❌ FALLIDO</p>
      <h3>Detalle del Error:</h3>
      <pre style="background:#f8f9fa; padding:12px; border-radius:4px;">${errorMsg}</pre>
      <p>Por favor revise los logs del servidor para más detalles.</p>
    `;
  }

  html += '</div>';

  const rawMessage = [
    `From: ${SENDER_EMAIL}`,
    `To: ${NOTIFICATION_EMAIL}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\n');

  const encoded = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const timestamp = getTimestamp();
  const backupDir = path.join(process.cwd(), 'backups', timestamp);
  const zipPath = path.join(process.cwd(), 'backups', `backup_${timestamp}.zip`);
  let stats: BackupStats | undefined;

  console.log('════════════════════════════════════════════');
  console.log('  🚀 BACKUP AUTOMÁTICO - AGENCIAS API');
  console.log(`  📅 ${timestamp}`);
  console.log('════════════════════════════════════════════\n');

  try {
    // 1. Exportar MongoDB
    fs.mkdirSync(backupDir, { recursive: true });
    stats = await exportarMongo(backupDir);
    console.log(`\n✅ Exportación completa: ${stats.colecciones} colecciones, ${stats.documentos.toLocaleString()} docs, ${stats.tamano}\n`);

    // 2. Comprimir
    console.log('🗜️  Comprimiendo a ZIP...');
    await comprimirDirectorio(backupDir, zipPath);
    const zipSize = formatBytes(fs.statSync(zipPath).size);
    console.log(`✅ ZIP creado: ${zipSize}\n`);

    // 3. Subir a Drive
    console.log('☁️  Subiendo a Google Drive...');
    const fileId = await subirADrive(zipPath, `backup_${timestamp}.zip`);
    console.log(`✅ Subido a Drive (ID: ${fileId})\n`);

    // 4. Retención
    console.log(`🧹 Aplicando retención (${RETENTION_DAYS} días)...`);
    const deleted = await limpiarBackupsAntiguos();
    console.log(`✅ ${deleted} backup(s) antiguos eliminados de Drive\n`);

    // 5. Correo de éxito
    console.log(`📧 Enviando notificación a ${NOTIFICATION_EMAIL}...`);
    await enviarCorreo(true, timestamp, stats);
    console.log('✅ Correo enviado\n');

    console.log('════════════════════════════════════════════');
    console.log('  🎉 BACKUP COMPLETADO EXITOSAMENTE');
    console.log('════════════════════════════════════════════');

  } catch (err: any) {
    console.error(`\n❌ Error: ${err.message}`);
    try {
      await enviarCorreo(false, timestamp, undefined, err.message);
      console.log('📧 Correo de alerta de fallo enviado.');
    } catch (emailErr: any) {
      console.error(`No se pudo enviar correo de alerta: ${emailErr.message}`);
    }
  } finally {
    // Limpiar archivos locales
    if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true });
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    console.log('\n🧹 Archivos temporales locales eliminados.');
  }
}

main();
