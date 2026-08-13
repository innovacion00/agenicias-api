import * as dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_GMAIL_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_GMAIL_CLIENT_SECRET!;
const REFRESH_TOKEN = process.env.GOOGLE_GMAIL_REFRESH_TOKEN!;
const SENDER_EMAIL = process.env.SENDER_EMAIL!;
const NOTIFICATION_EMAIL = process.env.BACKUP_NOTIFICATION_EMAIL || 'innovacion@gehsuites.com';

async function main() {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const subject = '✅ Backup Exitoso de MongoDB - Agencias API (2026-08-12_16-33-26)';
  const html = `
    <h2>Reporte de Backup Automático</h2>
    <p><strong>Fecha/Hora:</strong> 2026-08-12_16-33-26</p>
    <p style="color:green"><strong>Estado:</strong> Completado Exitosamente ✅</p>
    <h3>Estadísticas:</h3>
    <ul>
      <li><strong>Colecciones exportadas:</strong> 12</li>
      <li><strong>Total documentos:</strong> 41,514</li>
      <li><strong>Tamaño total JSON:</strong> 56.50 MB</li>
      <li><strong>Tamaño ZIP comprimido:</strong> 6.26 MB</li>
    </ul>
    <p>✅ El archivo fue guardado exitosamente en Google Drive.</p>
    <p><em>Colecciones excluidas: refreshtokens, otpverifications (datos temporales de un solo uso)</em></p>
  `;

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
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  console.log(`📧 Enviando correo de prueba a ${NOTIFICATION_EMAIL}...`);
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage },
  });
  console.log('✅ Correo enviado exitosamente!');
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
