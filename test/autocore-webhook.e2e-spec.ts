import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import * as request from 'supertest';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';

import { ReservasController } from '../src/reservas/reservas.controller';
import { ReservasService } from '../src/reservas/reservas.service';
import { MyToolBookingService } from '../src/reservas/services/my-tool-booking.service';
import {
  Reserva,
  ReservaSchema,
} from '../src/reservas/entities/reserva.entity';
import { User, UserSchema } from '../src/auth/entities/user.entity';
import {
  Agencia,
  AgenciaSchema,
} from '../src/agencias/entities/agencia.entity';
import { ValidPaymentStatus } from '../src/reservas/interfaces/validPaymentStatus.interface';
import { CancellationTasksQueueService } from '../src/reservas/cancellation-tasks-queue.service';
import { HttpCustomService } from '../src/common/services/http-custom.service';
import { SendEmailCustomService } from '../src/common/services/send-email.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../src/auth/guards/user-role.guard';

const TEST_AGENCIA_ID = new Types.ObjectId();
const TEST_USER_ID = new Types.ObjectId();

const mockAuthGuard: CanActivate = {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = { _id: TEST_USER_ID, agencia: TEST_AGENCIA_ID, role: ['admin'] };
    return true;
  },
};

const mockMyToolBookingService = {};
const mockHttpCustomService = {
  cancelarReservas: jest.fn().mockResolvedValue({ msg: 'OK' }),
};
const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue(true),
  sendMail: jest.fn().mockResolvedValue(true),
};
const mockCancellationQueue = { enqueue: jest.fn() };

const WEBHOOK_URL = '/agencias/v1/reservas/change-status';

describe('Autocore Webhook change-status (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;
  let reservaModel: Model<Reserva>;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Reserva.name, schema: ReservaSchema },
          { name: User.name, schema: UserSchema },
          { name: Agencia.name, schema: AgenciaSchema },
        ]),
      ],
      controllers: [ReservasController],
      providers: [
        ReservasService,
        { provide: MyToolBookingService, useValue: mockMyToolBookingService },
        { provide: HttpCustomService, useValue: mockHttpCustomService },
        { provide: SendEmailCustomService, useValue: mockEmailService },
        {
          provide: CancellationTasksQueueService,
          useValue: mockCancellationQueue,
        },
      ],
    })
      .overrideGuard(AuthGuard())
      .useValue(mockAuthGuard)
      .overrideGuard(UserRoleGuard)
      .useValue(mockAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('agencias/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    );
    await app.init();

    reservaModel = moduleFixture.get<Model<Reserva>>(
      getModelToken(Reserva.name),
    );
  }, 60000);

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  async function seedReserva(
    overrides: Partial<Reserva> = {},
  ): Promise<Reserva> {
    return reservaModel.create({
      userId: TEST_USER_ID,
      agenciaId: TEST_AGENCIA_ID,
      hotel: 'Hotel Test',
      cantidadHabitaciones: 1,
      total: 1000000,
      totalMitad: 500000,
      reservation: {
        source_of_bussiness: 'Booking Connect',
        adults: '2',
        checkin: '2026-12-01',
        checkout: '2026-12-03',
        children: '0',
        children_ages: '',
        city: 'CARTAGENA',
        country: 'COL',
        currency: 'COP',
        email: 'huesped@test.com',
        telephone: '3001234567',
        firstName: 'Test',
        lastName: 'User',
        nights: '2',
        notes: '',
        rooms: '1',
        roomsData: [
          {
            nombreHabitacion: 'Habitacion',
            adults: '2',
            children: '0',
            children_ages: '',
            checkin: '2026-12-01',
            checkout: '2026-12-03',
            currency: 'COP',
            id: '0',
            quantity: '1',
            rateId: '0',
            unitaryPrice: 1000000,
          },
        ],
      },
      reservaChatbotId: `CB-WEBHOOK-${new Types.ObjectId().toHexString()}`,
      reservaProvider: 'autocore',
      titularInfo: {
        firstName: 'Test',
        lastName: 'User',
        tipoDocumento: 'CC',
        documento: '123456',
        fechaNacimiento: '1990-01-01',
      },
      fechaLimitePago: '2026-11-25',
      status: ValidPaymentStatus.espera,
      ...overrides,
    });
  }

  function evento(
    reservaId: string,
    payment_status: string,
    opts: { txn?: string; pagoTotal?: boolean; detailId?: string } = {},
  ) {
    return {
      external_ref_id: opts.pagoTotal ? `${reservaId} pagoTotal` : reservaId,
      transaction_id: opts.txn ?? `txn-${reservaId}-${payment_status}`,
      payment_status,
      details: {
        id: opts.detailId ?? `det-${payment_status}`,
        pay_platform: 'tarjeta',
      },
    };
  }

  const post = (body: object) =>
    request(app.getHttpServer()).post(WEBHOOK_URL).send(body);

  it('flujo feliz: aplicado -> mitad, segundo aplicado -> total', async () => {
    const r = await seedReserva();
    const id = r._id.toString();

    await post(evento(id, 'aplicado', { txn: 'A1' })).expect(200);
    let db = await reservaModel.findById(id);
    expect(db!.status).toBe(ValidPaymentStatus.mitad);
    expect(db!.pagadoPrimeraMitad).toBe(true);

    await post(evento(id, 'aplicado', { txn: 'A2', pagoTotal: true })).expect(
      200,
    );
    db = await reservaModel.findById(id);
    expect(db!.status).toBe(ValidPaymentStatus.total);
    expect(db!.linksHistory).toHaveLength(2);
  });

  it('idempotencia: el mismo evento (mismo transaction_id) no se aplica dos veces', async () => {
    const r = await seedReserva();
    const id = r._id.toString();
    const ev = evento(id, 'aplicado', { txn: 'DUP1' });

    await post(ev).expect(200);
    await post(ev).expect(200);
    await post(ev).expect(200);

    const db = await reservaModel.findById(id);
    expect(db!.status).toBe(ValidPaymentStatus.mitad);
    expect(db!.linksHistory).toHaveLength(1);
    expect(db!.paymenIds.filter((k) => k.startsWith('DUP1')).length).toBe(1);
  });

  it('CASO 2: "en proceso" tardío NO debe degradar un pago ya total', async () => {
    const r = await seedReserva();
    const id = r._id.toString();

    await post(evento(id, 'aplicado', { txn: 'B1' })).expect(200);
    await post(evento(id, 'aplicado', { txn: 'B2', pagoTotal: true })).expect(
      200,
    );
    expect((await reservaModel.findById(id))!.status).toBe(
      ValidPaymentStatus.total,
    );

    // Evento "en proceso" que llega tarde / fuera de orden
    await post(evento(id, 'en proceso', { txn: 'B0' })).expect(200);

    const db = await reservaModel.findById(id);
    expect(db!.status).toBe(ValidPaymentStatus.total); // NO espera
  });

  it('CASO 2 (variante): "en proceso" tardío NO degrada una mitad pagada', async () => {
    const r = await seedReserva();
    const id = r._id.toString();

    await post(evento(id, 'aplicado', { txn: 'C1' })).expect(200);
    expect((await reservaModel.findById(id))!.status).toBe(
      ValidPaymentStatus.mitad,
    );

    await post(evento(id, 'en proceso', { txn: 'C0' })).expect(200);
    expect((await reservaModel.findById(id))!.status).toBe(
      ValidPaymentStatus.mitad,
    );
  });

  it('CASO 1: "rechazado" tardío NO debe sobreescribir un pago total', async () => {
    const r = await seedReserva({ pagadoPrimeraMitad: true });
    const id = r._id.toString();

    await post(evento(id, 'aplicado', { txn: 'D1', pagoTotal: true })).expect(
      200,
    );
    expect((await reservaModel.findById(id))!.status).toBe(
      ValidPaymentStatus.total,
    );

    // Rechazo tardío de un intento previo
    await post(evento(id, 'rechazado', { txn: 'D0' })).expect(200);

    const db = await reservaModel.findById(id);
    expect(db!.status).toBe(ValidPaymentStatus.total); // NO rejected
  });

  it('CASO 1 (variante): "rechazado" tardío NO sobreescribe una mitad pagada', async () => {
    const r = await seedReserva();
    const id = r._id.toString();

    await post(evento(id, 'aplicado', { txn: 'E1' })).expect(200);
    expect((await reservaModel.findById(id))!.status).toBe(
      ValidPaymentStatus.mitad,
    );

    await post(evento(id, 'rechazado', { txn: 'E0' })).expect(200);
    expect((await reservaModel.findById(id))!.status).toBe(
      ValidPaymentStatus.mitad,
    );
  });

  it('recuperación: un rechazo seguido de aplicado SÍ debe avanzar a mitad/total', async () => {
    const r = await seedReserva();
    const id = r._id.toString();

    await post(evento(id, 'rechazado', { txn: 'F0' })).expect(200);
    expect((await reservaModel.findById(id))!.status).toBe(
      ValidPaymentStatus.rejected,
    );

    await post(evento(id, 'aplicado', { txn: 'F1' })).expect(200);
    expect((await reservaModel.findById(id))!.status).toBe(
      ValidPaymentStatus.mitad,
    );
  });

  it('tolerancia de strings: "Aprobado" y "tarjeta no valida" se reconocen', async () => {
    const r1 = await seedReserva();
    const id1 = r1._id.toString();
    await post(evento(id1, 'Aprobado', { txn: 'G1' })).expect(200);
    expect((await reservaModel.findById(id1))!.status).toBe(
      ValidPaymentStatus.mitad,
    );

    const r2 = await seedReserva();
    const id2 = r2._id.toString();
    await post(evento(id2, 'Tarjeta no válida', { txn: 'G2' })).expect(200);
    expect((await reservaModel.findById(id2))!.status).toBe(
      ValidPaymentStatus.rejected,
    );
  });

  it('estado desconocido: responde 200 (ack) y no cambia el estado', async () => {
    const r = await seedReserva();
    const id = r._id.toString();

    await post(evento(id, 'estado_marciano_xyz', { txn: 'H1' })).expect(200);

    expect((await reservaModel.findById(id))!.status).toBe(
      ValidPaymentStatus.espera,
    );
  });

  it('reserva inexistente: responde 200 (ack) sin lanzar 500', async () => {
    const idFalso = new Types.ObjectId().toString();
    await post(evento(idFalso, 'aplicado', { txn: 'I1' })).expect(200);
  });

  it('estado terminal: una reserva cancelada no se modifica', async () => {
    const r = await seedReserva({ status: ValidPaymentStatus.cancelado });
    const id = r._id.toString();

    await post(evento(id, 'aplicado', { txn: 'J1' })).expect(200);
    expect((await reservaModel.findById(id))!.status).toBe(
      ValidPaymentStatus.cancelado,
    );
  });

  it('concurrencia: eventos simultáneos no producen estados inconsistentes', async () => {
    const r = await seedReserva();
    const id = r._id.toString();

    // 'aplicado' (mismo txn, duplicado) + 'en proceso' tardío disparados a la vez.
    await Promise.all([
      post(evento(id, 'aplicado', { txn: 'K1' })),
      post(evento(id, 'aplicado', { txn: 'K1' })),
      post(evento(id, 'aplicado', { txn: 'K1' })),
      post(evento(id, 'en proceso', { txn: 'K0' })),
      post(evento(id, 'en proceso', { txn: 'K0' })),
    ]);

    const db = await reservaModel.findById(id);
    // El pago aplicado nunca debe quedar degradado por "en proceso".
    expect(
      [ValidPaymentStatus.mitad, ValidPaymentStatus.total].includes(db!.status),
    ).toBe(true);
    // El evento 'aplicado' duplicado se registra una sola vez.
    expect(db!.paymenIds.filter((k) => k.startsWith('K1')).length).toBe(1);
  });
});
