/**
 * Inicializa el campo `abono` en todas las reservas existentes.
 * - Si falta o es null → se asigna 0.
 * - Si ya tiene valor → se conserva.
 *
 * Uso: npm run migrate:abono
 * Requiere MONGO_URL en .env (o entorno).
 */
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const COLLECTION = 'reservas';

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
    [{ $set: { abono: { $ifNull: ['$abono', 0] } } }],
  );

  console.log(
    `Migración abono (${COLLECTION}): matched=${result.matchedCount}, modified=${result.modifiedCount}`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
