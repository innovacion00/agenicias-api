/**
 * Backup de la base de datos MongoDB.
 *
 * Exporta todas las colecciones a archivos JSON individuales dentro de
 * una carpeta con timestamp en /backups/ (raíz del proyecto).
 *
 * Uso:
 *   npm run backup:db
 *
 * Requiere MONGO_URL en .env (o variable de entorno del sistema).
 *
 * Resultado:
 *   backups/
 *   └── 2026-08-12_09-30-00/
 *       ├── reservas.json
 *       ├── users.json
 *       ├── agencias.json
 *       ├── ...
 *       └── _resumen.json
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';

dotenv.config();

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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl?.trim()) {
    console.error('❌ MONGO_URL no está definida en .env');
    process.exit(1);
  }

  console.log('🔌 Conectando a MongoDB...');
  await mongoose.connect(mongoUrl);
  console.log('✅ Conectado\n');

  const db = mongoose.connection.db;
  if (!db) {
    console.error('❌ No se pudo establecer la conexión a la base de datos.');
    process.exit(1);
  }

  // Obtener lista de colecciones
  const collections = await db.listCollections().toArray();

  if (!collections.length) {
    console.warn('⚠️  No se encontraron colecciones en la base de datos.');
    await mongoose.disconnect();
    return;
  }

  // Crear carpeta de backup
  const timestamp = getTimestamp();
  const backupDir = path.join(process.cwd(), 'backups', timestamp);
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`📁 Carpeta de backup creada: backups/${timestamp}\n`);

  const resumen: {
    timestamp: string;
    mongoUrl: string;
    colecciones: { nombre: string; documentos: number; archivo: string; tamaño: string }[];
    totalDocumentos: number;
    totalTamaño: string;
  } = {
    timestamp,
    mongoUrl: mongoUrl.replace(/:\/\/[^@]+@/, '://***:***@'), // ocultar credenciales
    colecciones: [],
    totalDocumentos: 0,
    totalTamaño: '',
  };

  let totalBytes = 0;

  // Exportar cada colección
  const SKIP_COLLECTIONS = ['refreshtokens', 'otpverifications'];

  for (const colInfo of collections) {
    const colName = colInfo.name;

    if (SKIP_COLLECTIONS.includes(colName)) {
      console.log(`  ⏭️  Saltando "${colName}" (excluida del backup)`);
      continue;
    }

    process.stdout.write(`  📦 Exportando "${colName}"... `);

    const col = db.collection(colName);
    const documentos = await col.find({}).toArray();
    const jsonContent = JSON.stringify(documentos, null, 2);

    const filePath = path.join(backupDir, `${colName}.json`);
    fs.writeFileSync(filePath, jsonContent, 'utf-8');

    const bytes = Buffer.byteLength(jsonContent, 'utf-8');
    totalBytes += bytes;

    console.log(`${documentos.length} documentos (${formatBytes(bytes)})`);

    resumen.colecciones.push({
      nombre: colName,
      documentos: documentos.length,
      archivo: `${colName}.json`,
      tamaño: formatBytes(bytes),
    });
    resumen.totalDocumentos += documentos.length;
  }

  resumen.totalTamaño = formatBytes(totalBytes);

  // Guardar resumen
  const resumenPath = path.join(backupDir, '_resumen.json');
  fs.writeFileSync(resumenPath, JSON.stringify(resumen, null, 2), 'utf-8');

  console.log('\n─────────────────────────────────────────');
  console.log(`✅ Backup completado exitosamente`);
  console.log(`   📂 Ubicación : backups/${timestamp}/`);
  console.log(`   📊 Colecciones: ${resumen.colecciones.length}`);
  console.log(`   📄 Documentos : ${resumen.totalDocumentos.toLocaleString()}`);
  console.log(`   💾 Tamaño total: ${resumen.totalTamaño}`);
  console.log('─────────────────────────────────────────\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('\n❌ Error durante el backup:', err);
  process.exit(1);
});
