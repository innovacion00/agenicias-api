/**
 * Script para obtener el Refresh Token de Gmail API
 * 
 * INSTRUCCIONES:
 * 1. Configura las variables abajo con tus credenciales
 * 2. Ejecuta: node obtener-refresh-token.js
 * 3. Abre la URL que se muestra en la consola
 * 4. Autoriza la aplicación
 * 5. Copia el código de la URL de redirección
 * 6. Pega el código cuando el script lo solicite
 * 7. El Refresh Token se mostrará en la consola
 */

const readline = require('readline');
const https = require('https');

// ============================================
// CONFIGURA ESTAS VARIABLES CON TUS CREDENCIALES
// ============================================
const CLIENT_ID = '1013644179744-kn27eu4romoo24s7cah5um4uaeg7ldp4.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback'; // O la que configuraste en Google Cloud
const SCOPE = 'https://www.googleapis.com/auth/gmail.send';
// ============================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function obtenerRefreshToken() {
  try {
    console.log('\n=== OBTENER REFRESH TOKEN DE GMAIL API ===\n');
    
    // Paso 1: Generar URL de autorización
    const authUrl = `https://accounts.google.com/o/oauth2/auth?` +
      `client_id=${encodeURIComponent(CLIENT_ID)}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(SCOPE)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;

    console.log('1. Abre esta URL en tu navegador:');
    console.log('\n' + authUrl + '\n');
    console.log('2. Autoriza la aplicación');
    console.log('3. Serás redirigido a una URL que contiene "code=..."');
    console.log('4. Copia TODO el código que aparece después de "code="\n');

    // Esperar a que el usuario ingrese el código
    const authCode = await question('Pega el código de autorización aquí: ');

    if (!authCode || authCode.trim() === '') {
      console.error('❌ Error: No se proporcionó un código de autorización');
      rl.close();
      return;
    }

    console.log('\n⏳ Intercambiando código por tokens...\n');

    // Paso 2: Intercambiar código por tokens
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: authCode.trim(),
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    });

    const data = await new Promise((resolve, reject) => {
      const url = new URL(tokenUrl);
      const postData = params.toString();

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
            }
          } catch (error) {
            reject(new Error(`Error parsing response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });

    if (!data.refresh_token) {
      console.error('❌ Error: No se recibió refresh_token en la respuesta');
      console.error('Respuesta recibida:');
      console.error(JSON.stringify(data, null, 2));
      console.error('\n⚠️  Posibles causas:');
      console.error('   - El código de autorización ya fue usado (solo se puede usar una vez)');
      console.error('   - El redirect_uri no coincide con el configurado en Google Cloud');
      console.error('   - El código expiró (tiene validez de unos minutos)');
      rl.close();
      return;
    }

    // Mostrar los tokens obtenidos
    console.log('✅ ¡Tokens obtenidos exitosamente!\n');
    console.log('=== CONFIGURA ESTAS VARIABLES DE ENTORNO ===\n');
    console.log(`GOOGLE_GMAIL_API_KEY=${data.access_token || 'OPCIONAL'}`);
    console.log(`GOOGLE_GMAIL_URL=https://www.googleapis.com`);
    console.log(`GOOGLE_GMAIL_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_GMAIL_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GOOGLE_GMAIL_REFRESH_TOKEN=${data.refresh_token}\n`);
    console.log('=== IMPORTANTE ===');
    console.log('⚠️  Guarda el REFRESH_TOKEN de forma segura');
    console.log('⚠️  El ACCESS_TOKEN expira, pero el REFRESH_TOKEN es permanente');
    console.log('⚠️  El sistema refrescará automáticamente el ACCESS_TOKEN usando el REFRESH_TOKEN\n');

    rl.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
  }
}

obtenerRefreshToken();
