import * as mongoose from 'mongoose';
import { ReservaSchema } from 'src/reservas/entities/reserva.entity';

const BATCH_SIZE = 1000;

async function migrateNormalizedFields() {
  try {
    const mongoUri =
      process.env.MONGO_DB_URI || 'mongodb://localhost:27017/agencias-api';

    await mongoose.connect(mongoUri, {
      retryWrites: true,
      w: 'majority',
    });

    console.log('Conectado a MongoDB');

    const ReservaModel = mongoose.model<any>('Reserva', ReservaSchema);

    const totalCount = await ReservaModel.countDocuments();
    console.log(`Total de reservas a procesar: ${totalCount}`);

    let processedCount = 0;
    let batchNumber = 0;

    while (processedCount < totalCount) {
      const skip = batchNumber * BATCH_SIZE;
      const reservas = await ReservaModel.find({})
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean();

      if (reservas.length === 0) break;

      const bulkOps = reservas.map((reserva: any) => ({
        updateOne: {
          filter: { _id: reserva._id },
          update: {
            $set: {
              hotelLower: reserva.hotel ? reserva.hotel.toLowerCase() : '',
              titularFirstNameLower: reserva.reservation?.firstName
                ? reserva.reservation.firstName.toLowerCase()
                : '',
              titularLastNameLower: reserva.reservation?.lastName
                ? reserva.reservation.lastName.toLowerCase()
                : '',
            },
          },
        },
      }));

      if (bulkOps.length > 0) {
        const result = await ReservaModel.bulkWrite(bulkOps);
        console.log(
          `Lote ${batchNumber + 1}: ${result.modifiedCount} documentos actualizados`,
        );
      }

      processedCount += reservas.length;
      batchNumber++;
    }

    console.log(`Migracion completada. Total procesado: ${processedCount}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error durante la migracion:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateNormalizedFields();
