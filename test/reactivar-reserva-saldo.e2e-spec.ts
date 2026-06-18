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

const fakeUser = {
  _id: TEST_USER_ID,
  email: 'test@gehsuites.com',
  fullName: 'test user',
  isActive: true,
  role: ['admin'],
  agencia: TEST_AGENCIA_ID,
};

const mockAuthGuard: CanActivate = {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = fakeUser;
    return true;
  },
};

const mockGetEstadoCuentaReserva = jest.fn();

const mockMyToolBookingService = {
  findSlugByAutocoreId: jest.fn().mockReturnValue('aixo'),
  findSlugByHotelName: jest.fn().mockReturnValue('aixo'),
  getEstadoCuentaReserva: (...args: unknown[]) =>
    mockGetEstadoCuentaReserva(...args),
};

const mockCreateLinkPagoAutocore = jest.fn().mockResolvedValue({
  url: 'https://pay.test/link',
  code: 'LINK-CODE-001',
});

const mockCreateReservaAutocore = jest.fn().mockResolvedValue({
  chatbot_id: 'CB-NUEVA-001',
  msg: 'OK',
});

const mockHttpCustomService = {
  createReservaAutocore: (...args: unknown[]) =>
    mockCreateReservaAutocore(...args),
  createLinkPagoAutocore: (...args: unknown[]) =>
    mockCreateLinkPagoAutocore(...args),
  cancelarReservas: jest.fn().mockResolvedValue({ msg: 'OK' }),
};

const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue(true),
  sendMail: jest.fn().mockResolvedValue(true),
};

const mockCancellationQueue = {
  enqueueReactivationExpiryJob: jest.fn().mockReturnValue(true),
};

const REACTIVAR_URL = '/agencias/v1/reservas/reactivar';
const WEBHOOK_URL = '/agencias/v1/reservas/change-status';

function buildReservation() {
  return {
    source_of_bussiness: 'Booking Connect',
    adults: '2',
    checkin: '2026-07-01',
    checkout: '2026-07-04',
    children: '0',
    children_ages: '',
    city: 'CARTAGENA',
    country: 'COL',
    currency: 'COP',
    email: 'huesped@test.com',
    telephone: '3001234567',
    firstName: 'Test',
    lastName: 'User',
    nights: '3',
    notes: '',
    rooms: '1',
    roomsData: [
      {
        nombreHabitacion: 'Habitacion',
        adults: '2',
        children: '0',
        children_ages: '',
        checkin: '2026-07-01',
        checkout: '2026-07-04',
        currency: 'COP',
        id: '0',
        quantity: '1',
        rateId: '0',
        unitaryPrice: 1000000,
      },
    ],
  };
}

function pmsResponse(monto: number) {
  return {
    isSuccess: true,
    message: 'Reservas consultadas correctamente.',
    json: null,
    result: [
      {
        reservaId: 14986,
        localizador: 'CB-ORIGEN-001',
        pagos:
          monto > 0
            ? [
                {
                  reservaId: 14986,
                  fecha: '2026-06-06T22:55:40',
                  formaPago: 'Cr. MasterCard',
                  monto,
                },
              ]
            : [],
      },
    ],
  };
}

describe('Reactivar reserva con saldo previo (e2e)', () => {
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

    const agenciaModel = moduleFixture.get<Model<Agencia>>(
      getModelToken(Agencia.name),
    );
    const userModel = moduleFixture.get<Model<User>>(getModelToken(User.name));

    await agenciaModel.create({
      _id: TEST_AGENCIA_ID,
      emailContacto: 'agencia@test.com',
      telefonoContacto: '+573001111111',
      fullName: 'agencia test',
      slug: 'agencia-test',
      saldo: 0,
      category: 0,
      documentInfo: { tipo: 'NIT', document: '900111222' },
      cobreInfo: { bolcilloId: 'test-bol-001' },
      autocoreInfo: { id: 999 },
      isActive: true,
      userLimit: 10,
    });

    await userModel.create({
      _id: TEST_USER_ID,
      email: 'test@gehsuites.com',
      password: '$2b$10$fakehashfortest',
      telefono: '+573001234567',
      fullName: 'test user',
      isActive: true,
      role: ['admin'],
      agencia: TEST_AGENCIA_ID,
      reservas: [],
    });
  }, 60000);

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await reservaModel.deleteMany({});
    jest.clearAllMocks();
    mockMyToolBookingService.findSlugByAutocoreId.mockReturnValue('aixo');
    mockCreateReservaAutocore.mockResolvedValue({
      chatbot_id: 'CB-NUEVA-001',
      msg: 'OK',
    });
    mockCreateLinkPagoAutocore.mockResolvedValue({
      url: 'https://pay.test/link',
      code: 'LINK-CODE-001',
    });
  });

  async function seedReservaCancelada(
    overrides: Partial<Reserva> = {},
  ): Promise<Reserva> {
    return reservaModel.create({
      userId: TEST_USER_ID,
      agenciaId: TEST_AGENCIA_ID,
      hotel: 'Hotel Aixo',
      cantidadHabitaciones: 1,
      total: 1000000,
      totalMitad: 500000,
      reservation: buildReservation(),
      reservaChatbotId: 'CB-ORIGEN-001',
      reservaProvider: 'autocore',
      titularInfo: {
        firstName: 'Test',
        lastName: 'User',
        tipoDocumento: 'CC',
        documento: '123456',
        fechaNacimiento: '1990-01-01',
      },
      fechaLimitePago: '2026-06-25',
      status: ValidPaymentStatus.cancelado,
      pagadoPrimeraMitad: false,
      ...overrides,
    });
  }

  it('C1: pagadoPrimeraMitad=true genera link con totalMitad sin consultar PMS', async () => {
    await seedReservaCancelada({ pagadoPrimeraMitad: true });

    const res = await request(app.getHttpServer())
      .post(REACTIVAR_URL)
      .send({ reservaChatbotId: 'CB-ORIGEN-001' })
      .expect(201);

    expect(res.body.linkInfo).toBeDefined();
    expect(mockGetEstadoCuentaReserva).not.toHaveBeenCalled();
    expect(mockCreateLinkPagoAutocore).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500000 }),
    );
  });

  it('C2: PMS con pago igual a totalMitad genera link con totalMitad', async () => {
    await seedReservaCancelada();
    mockGetEstadoCuentaReserva.mockResolvedValue(pmsResponse(500000));

    await request(app.getHttpServer())
      .post(REACTIVAR_URL)
      .send({ reservaChatbotId: 'CB-ORIGEN-001' })
      .expect(201);

    expect(mockGetEstadoCuentaReserva).toHaveBeenCalledWith(
      'aixo',
      'CB-ORIGEN-001',
      '2026-07-01',
      '2026-07-04',
    );
    expect(mockCreateLinkPagoAutocore).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500000 }),
    );
  });

  it('C3: PMS con pago igual a total responde 409 y no crea reserva nueva', async () => {
    await seedReservaCancelada();
    mockGetEstadoCuentaReserva.mockResolvedValue(pmsResponse(1000000));

    const res = await request(app.getHttpServer())
      .post(REACTIVAR_URL)
      .send({ reservaChatbotId: 'CB-ORIGEN-001' })
      .expect(409);

    expect(res.body.code).toBe('REACTIVACION_YA_PAGADA');
    expect(mockCreateReservaAutocore).not.toHaveBeenCalled();
    expect(await reservaModel.countDocuments({ esReactivacion: true })).toBe(0);
  });

  it('C4: abono parcial genera link con total - montoPagado', async () => {
    await seedReservaCancelada();
    mockGetEstadoCuentaReserva.mockResolvedValue(pmsResponse(200000));

    await request(app.getHttpServer())
      .post(REACTIVAR_URL)
      .send({ reservaChatbotId: 'CB-ORIGEN-001' })
      .expect(201);

    expect(mockCreateLinkPagoAutocore).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 800000 }),
    );
  });

  it('C5: sin pagos en PMS genera link con total', async () => {
    await seedReservaCancelada();
    mockGetEstadoCuentaReserva.mockResolvedValue(pmsResponse(0));

    await request(app.getHttpServer())
      .post(REACTIVAR_URL)
      .send({ reservaChatbotId: 'CB-ORIGEN-001' })
      .expect(201);

    expect(mockCreateLinkPagoAutocore).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1000000 }),
    );
  });

  it('C6: external_id conserva pagoTotal y webhook completa reactivacion', async () => {
    await seedReservaCancelada();
    mockGetEstadoCuentaReserva.mockResolvedValue(pmsResponse(0));

    await request(app.getHttpServer())
      .post(REACTIVAR_URL)
      .send({ reservaChatbotId: 'CB-ORIGEN-001' })
      .expect(201);

    const linkCall = mockCreateLinkPagoAutocore.mock.calls[0][0];
    expect(linkCall.external_ref_id).toMatch(/ pagoTotal$/);

    const nueva = await reservaModel.findOne({ esReactivacion: true });
    expect(nueva).toBeTruthy();
    const nuevaId = nueva!._id.toString();
    const origenId = (await reservaModel.findOne({
      reservaChatbotId: 'CB-ORIGEN-001',
    }))!._id.toString();

    await request(app.getHttpServer())
      .post(WEBHOOK_URL)
      .send({
        external_ref_id: `${nuevaId} pagoTotal`,
        transaction_id: 'txn-reactivacion-total',
        payment_status: 'aplicado',
        details: { id: 'det-total', pay_platform: 'tarjeta' },
      })
      .expect(200);

    expect(await reservaModel.findById(origenId)).toBeNull();
    const final = await reservaModel.findById(nuevaId);
    expect(final!.status).toBe(ValidPaymentStatus.total);
    expect(final!.esReactivacion).toBe(false);
  });
});
