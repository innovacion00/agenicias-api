/**
 * Asegura que todas las agencias tengan el campo `maarlabApiKey` en MongoDB.
 * - Si falta o es null → se guarda cadena vacía ''.
 * - Si ya tiene valor (token) → se conserva.
 *
 * Uso: npm run migrate:maarlab-api-key
 * Requiere MONGO_URL en .env (o entorno).
 */
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const COLLECTION = 'agencias';

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl?.trim()) {
    console.error('MONGO_URL no está definida.');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  const col = mongoose.connection.collection(COLLECTION);

  const result = await col.updateMany(
    {},
    [{ $set: { maarlabApiKey: { $ifNull: ['$maarlabApiKey', ''] } } }],
  );

  console.log(
    `Migración maarlabApiKey (${COLLECTION}): matched=${result.matchedCount}, modified=${result.modifiedCount}`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
