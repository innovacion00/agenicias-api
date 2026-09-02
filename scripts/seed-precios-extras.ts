/**
 * Seed del catálogo `precios_extras`: tours, traslados, mascotas, alimentación
 * y descuento vuelo+hotel. Los precios copian los valores actualmente
 * hardcodeados en el front (InfoTours.js, DisponibilidadH.jsx, etc.),
 * de modo que el frontend puede migrar 1:1 sin cambios de valores.
 *
 * Uso:
 *   npm run seed:precios-extras
 *   npm run seed:precios-extras -- --clear   (borra la colección primero)
 *
 * Variable: MONGO_URL (requerido)
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import {
  ConceptoExtra,
  PrecioExtraSchema,
  UnidadExtra,
} from '../src/precios-extras/entities/precio-extra.entity';

dotenv.config();

const MODEL_NAME = 'SeedPrecioExtra';

/**
 * Metadata completa de los 15 tours (descripción, imágenes, includes, qué
 * llevar, no incluye, restricciones, política de anulación, schedule…).
 * Generado una sola vez desde el antiguo catálogo estático del front
 * (InfoTours.js). Fuente única = backend.
 */
type TourMetadata = {
  detalle: string;
  ciudad: string;
  precioCOP: number;
  precioUSD: number;
  informacion: {
    description: string;
    schedule: string;
    duration: string;
    meetingPoint: string;
    images: { main: string; side1: string; side2: string };
    includes: string[];
    toBring: string[];
    notIncludes: string[];
    restrictions: string;
    cancellationPolicy: string;
  };
};

const TOURS: TourMetadata[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tour-metadata.json'), 'utf8'),
);

// [ciudad, hotelId|null, tier, [soloCOP, ambosCOP], [soloUSD, ambosUSD]]
const TRASLADOS: [
  string,
  number | null,
  string,
  [number, number],
  [string, string],
][] = [
  ['CARTAGENA', null, 'estandar', [38000, 76000], ['12', '21']],
  ['CARTAGENA', 1, 'premium', [45000, 90000], ['14', '25']], // azuan
  ['CARTAGENA', 6, 'premium', [45000, 90000], ['14', '25']], // avexi
  ['CARTAGENA', 9, 'premium', [45000, 90000], ['14', '25']], // marina
  ['SANTA_MARTA', null, 'estandar', [70000, 140000], ['17', '34']],
  ['BOGOTA', null, 'estandar', [73200, 146200], ['17.7', '35.4']],
];

type ExtraBody = {
  concepto: ConceptoExtra;
  detalle: string;
  hotelId?: number | null;
  ciudad?: string | null;
  precioCOP?: number | null;
  precioUSD?: number | null;
  unidad: UnidadExtra;
  paxPorVehiculo?: number | null;
  porcentaje?: number | null;
  orden?: number;
  informacion?: Record<string, unknown>;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const clear = args.includes('--clear');
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl?.trim()) {
    console.error('MONGO_URL no está definida.');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5000 });
  const model = mongoose.model(MODEL_NAME, PrecioExtraSchema);

  if (clear) {
    await model.deleteMany({});
    console.log('Colección precios_extras vaciada.');
  }

  const body: ExtraBody[] = [];

  body.push({
    concepto: ConceptoExtra.descuento,
    detalle: 'Descuento vuelo + hotel',
    unidad: UnidadExtra.porcentaje,
    porcentaje: 0.05,
  });

  body.push({
    concepto: ConceptoExtra.mascota,
    detalle: 'Mascota',
    unidad: UnidadExtra.por_mascota,
    precioCOP: 75000,
    precioUSD: 21,
  });

  body.push({
    concepto: ConceptoExtra.alimentacion,
    detalle: 'Cena',
    unidad: UnidadExtra.por_persona,
    precioCOP: 30000,
  });
  body.push({
    concepto: ConceptoExtra.alimentacion,
    detalle: 'Almuerzo',
    unidad: UnidadExtra.por_persona,
    precioCOP: 30000,
  });

  body.push({
    concepto: ConceptoExtra.impuesto,
    detalle: 'IVA hospedaje',
    unidad: UnidadExtra.porcentaje,
    porcentaje: 19,
  });
  // Hoteles exentos de IVA: item específico con porcentaje 0
  [56, 123].forEach((hotelId) => {
    body.push({
      concepto: ConceptoExtra.impuesto,
      detalle: 'IVA hospedaje (exento)',
      hotelId,
      unidad: UnidadExtra.porcentaje,
      porcentaje: 0,
      informacion: { exento: true },
    });
  });

  TOURS.forEach((t, i) => {
    body.push({
      concepto: ConceptoExtra.tour,
      detalle: t.detalle,
      ciudad: t.ciudad,
      precioCOP: t.precioCOP,
      precioUSD: t.precioUSD,
      unidad: UnidadExtra.por_persona,
      orden: i + 1,
      informacion: t.informacion,
    });
  });

  TRASLADOS.forEach(([ciudad, hotelId, tier, pesos, dolares]) => {
    body.push({
      concepto: ConceptoExtra.traslado,
      detalle: `Traslado aeropuerto-hotel (1 vía) — ${ciudad} (${tier})`,
      ciudad,
      hotelId,
      precioCOP: pesos[0],
      precioUSD: Number(dolares[0]),
      unidad: UnidadExtra.por_vehiculo,
      paxPorVehiculo: 4,
      orden: 0,
      informacion: { tipo: 'solo', tier },
    });
    body.push({
      concepto: ConceptoExtra.traslado,
      detalle: `Traslado aeropuerto-hotel (ambos) — ${ciudad} (${tier})`,
      ciudad,
      hotelId,
      precioCOP: pesos[1],
      precioUSD: Number(dolares[1]),
      unidad: UnidadExtra.por_vehiculo,
      paxPorVehiculo: 4,
      orden: 1,
      informacion: { tipo: 'ambos', tier },
    });
  });

  let upserted = 0;
  let created = 0;

  for (const item of body) {
    const filter: Record<string, unknown> = {
      concepto: item.concepto,
      detalle: item.detalle,
      ciudad: item.ciudad ?? null,
      hotelId: item.hotelId ?? null,
    };
    const valores: Record<string, unknown> = {
      ...item,
      activo: true,
    };
    delete valores.concepto;
    delete valores.detalle;
    delete valores.ciudad;
    delete valores.hotelId;

    const res = await model.updateOne(filter, { $set: valores }, { upsert: true });
    if (res.upsertedCount > 0) {
      created += 1;
    } else {
      upserted += 1;
    }
  }

  const total = await model.countDocuments();
  console.log(
    `Seed precios_extras finalizado: ${created} creados, ${upserted} actualizados. Total en BD: ${total}`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});