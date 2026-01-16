/**
 * Script para corregir el GOOGLE_GMAIL_REFRESH_TOKEN en el archivo .env
 */

const fs = require('fs');
const path = require('path');

const refreshToken = '1//01RQZotBw2AtUCgYIARAAGAESNwF-L9Ir8YJyqPIDp80pF8I8NWwx-D6XYvGpX8cBZOKH_El2fGsHhSrfR5r1yJ_O9JmsDikb6Gw';
const envPath = path.join(__dirname, '.env');

try {
  let content = fs.readFileSync(envPath, 'utf8');
  
  // Buscar y reemplazar la línea del refresh token (puede estar en múltiples líneas)
  const lines = content.split(/\r?\n/);
  const newLines = [];
  let skipNext = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    
    if (lines[i].startsWith('GOOGLE_GMAIL_REFRESH_TOKEN=')) {
      // Si la línea siguiente no empieza con GOOGLE_ y parece ser continuación del token
      if (i + 1 < lines.length && 
          !lines[i + 1].includes('=') && 
          lines[i + 1].trim().length > 0) {
        // Es una continuación, saltarla
        newLines.push(`GOOGLE_GMAIL_REFRESH_TOKEN=${refreshToken}`);
        skipNext = true;
        continue;
      } else {
        // Reemplazar toda la línea
        newLines.push(`GOOGLE_GMAIL_REFRESH_TOKEN=${refreshToken}`);
        continue;
      }
    }
    
    newLines.push(lines[i]);
  }
  
  // Escribir el archivo corregido
  fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
  
  console.log('✅ Archivo .env corregido exitosamente');
  console.log(`✅ GOOGLE_GMAIL_REFRESH_TOKEN configurado correctamente\n`);
  
  // Verificar
  const verifyContent = fs.readFileSync(envPath, 'utf8');
  const match = verifyContent.match(/^GOOGLE_GMAIL_REFRESH_TOKEN=(.+)$/m);
  if (match) {
    const token = match[1].trim();
    if (token === refreshToken) {
      console.log('✅ Verificación: El token está correctamente configurado');
    } else {
      console.log('⚠️  Verificación: El token puede tener espacios o caracteres extra');
      console.log(`   Esperado: ${refreshToken.substring(0, 20)}...`);
      console.log(`   Encontrado: ${token.substring(0, 20)}...`);
    }
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
