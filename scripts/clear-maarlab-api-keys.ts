/**
 * Limpia `maarlabApiKey` en TODAS las agencias, asignando ''.
 *
 * Uso:
 *   npm run script:clear-maarlab-api-keys
 *
 * Requiere:
 *   MONGO_URL en .env (o variable de entorno).
 */
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const COLLECTION = 'agencias';

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL?.trim();
  if (!mongoUrl) {
    console.error('MONGO_URL no está definida.');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  const col = mongoose.connection.collection(COLLECTION);

  const result = await col.updateMany({}, { $set: { maarlabApiKey: '' } });

  console.log(
    `Limpieza maarlabApiKey (${COLLECTION}): matched=${result.matchedCount}, modified=${result.modifiedCount}`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
