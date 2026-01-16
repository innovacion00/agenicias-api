/**
 * Script para verificar que las variables de entorno de Gmail estén configuradas correctamente
 * 
 * Ejecuta: node verificar-variables-gmail.js
 */

require('dotenv').config();

console.log('\n=== VERIFICACIÓN DE VARIABLES DE ENTORNO GMAIL ===\n');

const variables = {
  'GOOGLE_GMAIL_API_KEY': process.env.GOOGLE_GMAIL_API_KEY,
  'GOOGLE_GMAIL_URL': process.env.GOOGLE_GMAIL_URL,
  'GOOGLE_GMAIL_CLIENT_ID': process.env.GOOGLE_GMAIL_CLIENT_ID,
  'GOOGLE_GMAIL_CLIENT_SECRET': process.env.GOOGLE_GMAIL_CLIENT_SECRET,
  'GOOGLE_GMAIL_REFRESH_TOKEN': process.env.GOOGLE_GMAIL_REFRESH_TOKEN,
};

let hayErrores = false;

for (const [nombre, valor] of Object.entries(variables)) {
  if (!valor || valor.trim() === '') {
    console.log(`❌ ${nombre}: NO CONFIGURADA`);
    hayErrores = true;
  } else {
    const valorMostrar = nombre.includes('SECRET') || nombre.includes('TOKEN') || nombre.includes('KEY')
      ? `${valor.substring(0, 20)}... (${valor.length} caracteres)`
      : valor;
    console.log(`✅ ${nombre}: ${valorMostrar}`);
  }
}

if (hayErrores) {
  console.log('\n⚠️  ERROR: Faltan variables de entorno');
  console.log('\nConfigura estas variables en tu archivo .env:\n');
  console.log('GOOGLE_GMAIL_API_KEY=tu_access_token_inicial  # Opcional');
  console.log('GOOGLE_GMAIL_URL=https://www.googleapis.com');
  console.log('GOOGLE_GMAIL_CLIENT_ID=1013644179744-kn27eu4romoo24s7cah5um4uaeg7ldp4.apps.googleusercontent.com');
  console.log('GOOGLE_GMAIL_CLIENT_SECRET=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');
  console.log('GOOGLE_GMAIL_REFRESH_TOKEN=1//01RQZotBw2AtUCgYIARAAGAESNwF-L9Ir8YJyqPIDp80pF8I8NWwx-D6XYvGpX8cBZOKH_El2fGsHhSrfR5r1yJ_O9JmsDikb6Gw\n');
  process.exit(1);
} else {
  console.log('\n✅ Todas las variables están configuradas');
  
  // Validar formato del refresh token
  const refreshToken = variables['GOOGLE_GMAIL_REFRESH_TOKEN'].trim();
  if (!refreshToken.startsWith('1//')) {
    console.log('\n⚠️  ADVERTENCIA: El refresh token no tiene el formato esperado');
    console.log('   Debería comenzar con "1//"');
  }
  
  console.log('\n✅ Verificación completada\n');
}
