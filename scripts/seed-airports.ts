/**
 * Carga masiva del catálogo de aeropuertos (JSON tipo OpenFlights / OurAirports) en MongoDB.
 *
 * Uso:
 *   npm run seed:airports -- "C:\ruta\airports.json"
 *   npm run seed:airports -- --clear "C:\ruta\airports.json"
 *   npm run seed:airports -- --indexes-only
 *     (solo syncIndexes; útil si los datos ya cargaron y falló la creación de índices)
 *
 * Variables:
 *   MONGO_URL (requerido)
 *   AIRPORTS_JSON_PATH (opcional, por defecto ./data/airports.json)
 *
 * Recomendación: copia tu airports.json a ./data/airports.json (ignorado en git).
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { AeropuertoReferenciaSchema } from '../src/referencia-aeropuertos/entities/aeropuerto-referencia.entity';

dotenv.config();

const BATCH = 4000;
const MODEL_NAME = 'SeedAeropuertoRef';

type RawAirport = {
  icao: string;
  iata: string;
  name: string;
  city: string;
  state: string;
  country: string;
  elevation: number;
  lat: number;
  lon: number;
  tz: string;
};

function buildDocs(raw: Record<string, RawAirport>) {
  const docs: Record<string, unknown>[] = [];
  for (const [, a] of Object.entries(raw)) {
    const iata =
      typeof a.iata === 'string' && a.iata.trim() !== ''
        ? a.iata.trim().toUpperCase()
        : undefined;
    const doc: Record<string, unknown> = {
      icao: a.icao,
      name: a.name,
      city: a.city,
      state: a.state || '',
      country: a.country,
      elevation: a.elevation ?? null,
      lat: a.lat ?? null,
      lon: a.lon ?? null,
      tz: a.tz || '',
      normName: (a.name || '').toLowerCase().trim(),
      normCity: (a.city || '').toLowerCase().trim(),
    };
    if (iata) doc.iata = iata;
    docs.push(doc);
  }
  return docs;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const clear = args.includes('--clear');
  const indexesOnly = args.includes('--indexes-only');
  const pathArg = args.find((a) => !a.startsWith('--'));
  const jsonPath =
    pathArg ||
    process.env.AIRPORTS_JSON_PATH ||
    path.join(process.cwd(), 'data', 'airports.json');

  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl?.trim()) {
    console.error('MONGO_URL no está definida.');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  const Model =
    mongoose.models[MODEL_NAME] ??
    mongoose.model(MODEL_NAME, AeropuertoReferenciaSchema);

  if (indexesOnly) {
    console.log(`Sincronizando índices (solo)...`);
    await Model.syncIndexes();
    console.log(`Índices listos.`);
    await mongoose.disconnect();
    return;
  }

  if (!fs.existsSync(jsonPath)) {
    console.error(`No existe el archivo: ${jsonPath}`);
    process.exit(1);
  }

  console.log(`Leyendo ${jsonPath}...`);
  const raw = JSON.parse(
    fs.readFileSync(jsonPath, 'utf-8'),
  ) as Record<string, RawAirport>;
  const docs = buildDocs(raw);
  console.log(`Documentos a insertar: ${docs.length}`);

  if (clear) {
    const del = await Model.deleteMany({});
    console.log(`Colección limpiada: eliminados ${del.deletedCount}`);
  }

  const t0 = Date.now();
  for (let i = 0; i < docs.length; i += BATCH) {
    const slice = docs.slice(i, i + BATCH);
    await Model.insertMany(slice, { ordered: false });
    console.log(
      `Insertados ${Math.min(i + BATCH, docs.length)} / ${docs.length}`,
    );
  }

  console.log(`Sincronizando índices...`);
  await Model.syncIndexes();
  console.log(`Listo en ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
