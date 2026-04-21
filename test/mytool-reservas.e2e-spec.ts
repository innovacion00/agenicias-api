import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import * as request from 'supertest';
import { MongooseModule, getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Model, Connection, Types } from 'mongoose';

import { ReservasController } from '../src/reservas/reservas.controller';
import { ReservasService } from '../src/reservas/reservas.service';
import { MyToolBookingService } from '../src/reservas/services/my-tool-booking.service';
import { Reserva, ReservaSchema } from '../src/reservas/entities/reserva.entity';
import { User, UserSchema } from '../src/auth/entities/user.entity';
import { Agencia, AgenciaSchema } from '../src/agencias/entities/agencia.entity';
import { ValidPaymentStatus } from '../src/reservas/interfaces/validPaymentStatus.interface';
import { CancellationTasksQueueService } from '../src/reservas/cancellation-tasks-queue.service';
import { HttpCustomService } from '../src/common/services/http-custom.service';
import { SendEmailCustomService } from '../src/common/services/send-email.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../src/auth/guards/user-role.guard';

// ─── Fake user injected by the mock guard ───
const TEST_AGENCIA_ID = new Types.ObjectId();
const TEST_USER_ID = new Types.ObjectId();

const fakeUser = {
  _id: TEST_USER_ID,
  email: 'test@gehsuites.com',
  fullName: 'test user',
  isActive: true,
  role: ['admin'],
  agencia: TEST_AGENCIA_ID,
  telefono: '+573001234567',
  reservas: [],
  save: jest.fn().mockResolvedValue(true),
};

// ─── Mock AuthGuard (bypasses JWT) ───
const mockAuthGuard: CanActivate = {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = fakeUser;
    return true;
  },
};

// ─── Mock external services ───
const mockMyToolBookingService = {
  authenticate: jest.fn().mockResolvedValue('fake-token'),
  getMappings: jest.fn().mockResolvedValue({
    categorias: [
      { id: 1, tipo: 'Categorias', mapCode: 1, mapName: 'Estandar' },
      { id: 2, tipo: 'Categorias', mapCode: 2, mapName: 'Superior' },
    ],
    ratePlans: [
      { id: 10, tipo: 'RatePlan', mapCode: 99098, mapName: 'Tarifa Base' },
    ],
    segmentos: [
      { id: 20, tipo: 'Segmentos', mapCode: 1, mapName: 'Turismo' },
    ],
    subSegmentos: [
      { id: 30, tipo: 'Sub Segmentos', mapCode: 1, mapName: 'General' },
    ],
    motivos: [
      { id: 40, tipo: 'Motivos', mapCode: 8, mapName: 'Vacaciones' },
    ],
    canalesVenta: [
      { id: 50, tipo: 'Canal de Venta', mapCode: 41, mapName: 'OTA' },
    ],
  }),
  createBooking: jest.fn().mockImplementation((_slug: string, body: any) =>
    Promise.resolve({
      isSuccess: true,
      message: 'Reserva creada',
      localizador: body.bookData.localizador,
      result: { id: 123 },
    }),
  ),
  cancelBooking: jest.fn().mockResolvedValue({
    isSuccess: true,
    message: 'Reserva cancelada',
  }),
  searchBooking: jest.fn().mockResolvedValue({
    isSuccess: true,
    message: 'Reserva encontrada',
    result: { localizador: 'RES-TEST-001', estado: 'Activa' },
  }),
  getHotelConfig: jest.fn().mockReturnValue({
    ip: 'http://fake-hotel:59000',
    autocoreId: '13633',
    name: 'Hotel Aixo',
    city: 'Cartagena',
  }),
  findSlugByHotelName: jest.fn().mockReturnValue('aixo'),
  findSlugByAutocoreId: jest.fn().mockReturnValue('aixo'),
};

const mockHttpCustomService = {
  createReservaAutocore: jest.fn().mockResolvedValue({
    chatbot_id: 'AUTOCORE-FALLBACK-001',
    msg: 'OK',
  }),
  cancelarReservas: jest.fn().mockResolvedValue({ msg: 'OK' }),
};

const mockEmailService = {
  sendMail: jest.fn().mockResolvedValue(true),
  sendNotification: jest.fn().mockResolvedValue(true),
};

const mockCancellationQueue = {
  enqueue: jest.fn(),
};

// ─── Valid request body for creating a MyTool reservation ───
function buildValidCreateDto() {
  return {
    hotelId: 1,
    checkIn: '2026-12-01',
    checkOut: '2026-12-06',
    usuario: 'test-user',
    maquinaId: 1,
    bookData: {
      solicitante: {
        titular: 'Carlos Test',
        telefono: '3001234567',
        email: 'test@email.com',
      },
      canalVentaId: 41,
      ratePlan: '99098',
      paisCode: 'CO',
      monedaCode: 'COP',
      comision: 0,
      siAgregaImpto: false,
      acuerdos: '',
      motivoId: 8,
      subSegmentoId: 1,
      segmentoId: 1,
      agenciaId: 0,
      agenteId: 0,
    },
    rooms: [
      {
        categoriaId: 1,
        paxAdultos: 2,
        paxChilds: 0,
        dayPrice: [
          { fecha: '2026-12-01', precioBase: 300000 },
          { fecha: '2026-12-02', precioBase: 300000 },
          { fecha: '2026-12-03', precioBase: 300000 },
          { fecha: '2026-12-04', precioBase: 300000 },
          { fecha: '2026-12-05', precioBase: 300000 },
        ],
        guest: [
          {
            documId: '1020304050',
            documTypeId: 1,
            name: 'Juan Carlos',
            firstLastName: 'Vega',
            secondLastName: 'Gonzalez',
            birthDay: '1980-06-04T00:00:00',
            nacionalityId: 47,
            generId: 1,
            address: 'Calle 123 #45-67',
            city: 'Bogotá',
            phone: '3001234567',
            countryId: 47,
            email: 'juan.vega@email.com',
            isOwner: true,
          },
        ],
      },
    ],
    titularInfo: {
      firstName: 'Juan Carlos',
      lastName: 'Vega Gonzalez',
      tipoDocumento: 'Cédula de ciudadanía',
      documento: '1020304050',
      fechaNacimiento: '1980-06-04',
    },
    total: 1500000,
  };
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════
describe('MyTool Reservas (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;
  let reservaModel: Model<Reserva>;
  let userModel: Model<User>;
  let agenciaModel: Model<Agencia>;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const mongoUri = mongod.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
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
        { provide: CancellationTasksQueueService, useValue: mockCancellationQueue },
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

    reservaModel = moduleFixture.get<Model<Reserva>>(getModelToken(Reserva.name));
    userModel = moduleFixture.get<Model<User>>(getModelToken(User.name));
    agenciaModel = moduleFixture.get<Model<Agencia>>(getModelToken(Agencia.name));

    // Seed test agencia & user
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

    // Force collection + index creation so transactions don't hit "catalog changes"
    const seedReserva = await reservaModel.create({
      userId: TEST_USER_ID,
      agenciaId: TEST_AGENCIA_ID,
      hotel: 'Seed Hotel',
      cantidadHabitaciones: 1,
      total: 1,
      reservation: {
        source_of_bussiness: '', adults: '1', checkin: '2026-01-01',
        checkout: '2026-01-02', children: '0', children_ages: '',
        city: 'X', country: 'CO', currency: 'COP', email: 'x@x.com',
        telephone: '0', firstName: 'S', lastName: 'S', nights: '1',
        notes: '', rooms: '1', roomsData: [{
          nombreHabitacion: 'H', adults: '1', children: '0',
          children_ages: '', checkin: '2026-01-01', checkout: '2026-01-02',
          currency: 'COP', id: '0', quantity: '1', rateId: '0', unitaryPrice: 1,
        }],
      },
      reservaChatbotId: 'SEED-INDEX-INIT',
      reservaProvider: 'autocore',
      titularInfo: {
        firstName: 'S', lastName: 'S', tipoDocumento: 'CC',
        documento: '000000', fechaNacimiento: '2000-01-01',
      },
      fechaLimitePago: '2026-01-01',
      status: ValidPaymentStatus.espera,
    });
    await seedReserva.deleteOne();
  }, 60000);

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // GET mappings
  // ─────────────────────────────────────────────
  describe('GET /agencias/v1/reservas/mytool/:hotelSlug/mappings', () => {
    it('debe retornar los mappings del hotel correctamente', async () => {
      const res = await request(app.getHttpServer())
        .get('/agencias/v1/reservas/mytool/aixo/mappings')
        .expect(200);

      expect(res.body).toHaveProperty('categorias');
      expect(res.body).toHaveProperty('ratePlans');
      expect(res.body).toHaveProperty('segmentos');
      expect(res.body).toHaveProperty('subSegmentos');
      expect(res.body).toHaveProperty('motivos');
      expect(res.body).toHaveProperty('canalesVenta');
      expect(res.body.categorias).toHaveLength(2);
      expect(mockMyToolBookingService.getMappings).toHaveBeenCalledWith('aixo');
    });

    it('debe rechazar un hotel slug inválido con 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/agencias/v1/reservas/mytool/hotel-inexistente/mappings')
        .expect(400);

      expect(res.body.message).toContain('no es valido');
    });
  });

  // ─────────────────────────────────────────────
  // POST crear reserva
  // ─────────────────────────────────────────────
  describe('POST /agencias/v1/reservas/mytool/:hotelSlug', () => {
    it('debe crear una reserva exitosamente con MyTool', async () => {
      const dto = buildValidCreateDto();

      const res = await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/aixo')
        .send(dto)
        .expect(201);

      expect(res.body).toHaveProperty('reservaId');
      expect(res.body).toHaveProperty('reservaChatbotId');
      expect(res.body.reservaProvider).toBe('mytool');
      expect(res.body.hotel).toBe('Hotel Aixo');
      expect(res.body.usedFallback).toBe(false);

      expect(mockMyToolBookingService.createBooking).toHaveBeenCalledWith(
        'aixo',
        expect.objectContaining({
          hotelId: 1,
          checkIn: '2026-12-01',
          checkOut: '2026-12-06',
          bookData: expect.objectContaining({
            localizador: expect.stringMatching(/^CB[0-9A-F]{8}$/),
          }),
        }),
      );

      expect(res.body.reservaChatbotId).toMatch(/^CB[0-9A-F]{8}$/);

      const savedReserva = await reservaModel.findOne({
        reservaChatbotId: res.body.reservaChatbotId,
      });
      expect(savedReserva).toBeTruthy();
      expect(savedReserva!.hotel).toBe('Hotel Aixo');
      expect(savedReserva!.reservaProvider).toBe('mytool');
      expect(savedReserva!.total).toBe(1500000);
    });

    it('debe usar fallback a Autocore cuando MyTool falla', async () => {
      mockMyToolBookingService.createBooking.mockRejectedValueOnce(
        Object.assign(new Error('MyTool unavailable'), {
          response: { status: 500, data: { message: 'Server Error' } },
        }),
      );

      const dto = buildValidCreateDto();

      const res = await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/aixo')
        .send(dto)
        .expect(201);

      expect(res.body.reservaProvider).toBe('autocore');
      expect(res.body.usedFallback).toBe(true);
      expect(mockHttpCustomService.createReservaAutocore).toHaveBeenCalled();
    });

    it('debe fallar sin fallback para hotel sin autocoreId (marques)', async () => {
      mockMyToolBookingService.createBooking.mockRejectedValueOnce(
        new Error('MyTool unavailable'),
      );
      mockMyToolBookingService.getHotelConfig.mockReturnValueOnce({
        ip: 'http://fake-marques:59000',
        autocoreId: null,
        name: 'Hotel El Marques',
        city: 'Cartagena',
      });

      const dto = buildValidCreateDto();

      const res = await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/marques')
        .send(dto);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('debe limpiar campos null de guest (image1, image2)', async () => {
      const dto = buildValidCreateDto();
      (dto.rooms[0].guest[0] as any).image1 = null;
      (dto.rooms[0].guest[0] as any).image2 = null;

      await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/aixo')
        .send(dto)
        .expect(201);

      const calledBody = mockMyToolBookingService.createBooking.mock.calls[0][1];
      const sentGuest = calledBody.rooms[0].guest[0];
      expect(sentGuest).not.toHaveProperty('image1');
      expect(sentGuest).not.toHaveProperty('image2');
    });

    it('debe rechazar body sin campos requeridos (sin bookData)', async () => {
      const invalidDto = {
        hotelId: 1,
        checkIn: '2026-12-01',
        checkOut: '2026-12-06',
        rooms: [],
        titularInfo: {
          firstName: 'Test',
          lastName: 'User',
          tipoDocumento: 'CC',
          documento: '1234567890',
          fechaNacimiento: '1990-01-01',
        },
        total: 100000,
      };

      const res = await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/aixo')
        .send(invalidDto)
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('debe rechazar checkIn con formato inválido', async () => {
      const dto = buildValidCreateDto();
      dto.checkIn = '01-12-2026';

      const res = await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/aixo')
        .send(dto)
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('debe rechazar checkOut con formato inválido', async () => {
      const dto = buildValidCreateDto();
      dto.checkOut = '2026/12/06';

      const res = await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/aixo')
        .send(dto)
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('debe rechazar hotel slug inválido', async () => {
      const dto = buildValidCreateDto();

      const res = await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/hotel-falso')
        .send(dto)
        .expect(400);

      expect(res.body.message).toContain('no es valido');
    });
  });

  // ─────────────────────────────────────────────
  // POST cancelar reserva
  // ─────────────────────────────────────────────
  describe('POST /agencias/v1/reservas/mytool/cancelar', () => {
    let savedReservaId: string;

    beforeEach(async () => {
      const reserva = await reservaModel.create({
        userId: TEST_USER_ID,
        agenciaId: TEST_AGENCIA_ID,
        hotel: 'Hotel Aixo',
        cantidadHabitaciones: 1,
        total: 500000,
        totalMitad: 250000,
        reservation: {
          source_of_bussiness: 'Booking Connect',
          adults: '2',
          checkin: '2026-12-01',
          checkout: '2026-12-06',
          children: '0',
          children_ages: '',
          city: 'CARTAGENA',
          country: 'COL',
          currency: 'COP',
          email: 'test@email.com',
          telephone: '3001234567',
          firstName: 'Test',
          lastName: 'User',
          nights: '5',
          notes: '',
          rooms: '1',
          roomsData: [
            {
              nombreHabitacion: 'Habitacion',
              adults: '2',
              children: '0',
              children_ages: '',
              checkin: '2026-12-01',
              checkout: '2026-12-06',
              currency: 'COP',
              id: '0',
              quantity: '1',
              rateId: '0',
              unitaryPrice: 500000,
            },
          ],
        },
        reservaChatbotId: `RES-CANCEL-${Date.now()}`,
        reservaProvider: 'mytool',
        myToolCanalVentaId: 101,
        titularInfo: {
          firstName: 'Test',
          lastName: 'User',
          tipoDocumento: 'CC',
          documento: '1234567890',
          fechaNacimiento: '1990-01-01',
        },
        fechaLimitePago: '2026-11-25',
        status: ValidPaymentStatus.espera,
      });
      savedReservaId = reserva._id.toString();
    });

    it('debe cancelar una reserva mytool existente con su canalVentaId', async () => {
      const res = await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/cancelar')
        .send({ reservaId: savedReservaId })
        .expect(201);

      expect(res.body.msg).toContain('cancelada correctamente');
      expect(mockMyToolBookingService.cancelBooking).toHaveBeenCalledWith(
        'aixo',
        expect.any(String),
        expect.any(String),
        101,
      );

      const updated = await reservaModel.findById(savedReservaId);
      expect(updated!.status).toBe(ValidPaymentStatus.cancelado);
    });

    it('debe retornar 404 si la reserva no existe', async () => {
      const fakeId = new Types.ObjectId().toString();

      const res = await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/cancelar')
        .send({ reservaId: fakeId });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('debe retornar mensaje si la reserva ya está cancelada', async () => {
      await reservaModel.findByIdAndUpdate(savedReservaId, {
        status: ValidPaymentStatus.cancelado,
      });

      const res = await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/cancelar')
        .send({ reservaId: savedReservaId })
        .expect(201);

      expect(res.body.msg).toContain('ya está cancelada');
      expect(mockMyToolBookingService.cancelBooking).not.toHaveBeenCalled();
    });

    it('debe usar fallback Autocore si cancelación MyTool falla', async () => {
      mockMyToolBookingService.cancelBooking.mockRejectedValueOnce(
        new Error('MyTool cancel failed'),
      );

      const res = await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/cancelar')
        .send({ reservaId: savedReservaId })
        .expect(201);

      expect(res.body.msg).toContain('cancelada correctamente');
      expect(mockHttpCustomService.cancelarReservas).toHaveBeenCalled();
    });

    it('no debe confundir "cancelar" como hotelSlug', async () => {
      const res = await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/cancelar')
        .send({ reservaId: savedReservaId });

      expect(res.body.message ?? '').not.toContain('no es valido');
      expect(res.body).toHaveProperty('msg');
    });

    it('debe rechazar body sin reservaId', async () => {
      const res = await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/cancelar')
        .send({})
        .expect(400);

      expect(res.body.message).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────
  // GET buscar reserva
  // ─────────────────────────────────────────────
  describe('GET /agencias/v1/reservas/mytool/:hotelSlug/buscar', () => {
    it('debe buscar una reserva por localizador y nombre', async () => {
      const res = await request(app.getHttpServer())
        .get('/agencias/v1/reservas/mytool/aixo/buscar')
        .query({ localizador: 'RES-TEST-001', nombre: 'Juan' })
        .expect(200);

      expect(res.body).toHaveProperty('isSuccess', true);
      expect(mockMyToolBookingService.searchBooking).toHaveBeenCalledWith(
        'aixo',
        'RES-TEST-001',
        'Juan',
      );
    });

    it('debe rechazar hotel slug inválido', async () => {
      const res = await request(app.getHttpServer())
        .get('/agencias/v1/reservas/mytool/invalido/buscar')
        .query({ localizador: 'RES-TEST-001', nombre: 'Juan' })
        .expect(400);

      expect(res.body.message).toContain('no es valido');
    });
  });

  // ─────────────────────────────────────────────
  // Validaciones de rutas y prioridad
  // ─────────────────────────────────────────────
  describe('Routing & prioridad de rutas', () => {
    it('POST mytool/cancelar NO debe ser interceptado por mytool/:hotelSlug', async () => {
      const reserva = await reservaModel.create({
        userId: TEST_USER_ID,
        agenciaId: TEST_AGENCIA_ID,
        hotel: 'Hotel Aixo',
        cantidadHabitaciones: 1,
        total: 100000,
        reservation: {
          source_of_bussiness: 'Booking Connect',
          adults: '1',
          checkin: '2026-12-01',
          checkout: '2026-12-02',
          children: '0',
          children_ages: '',
          city: 'CARTAGENA',
          country: 'COL',
          currency: 'COP',
          email: 'route@test.com',
          telephone: '3001234567',
          firstName: 'Route',
          lastName: 'Test',
          nights: '1',
          notes: '',
          rooms: '1',
          roomsData: [
            {
              nombreHabitacion: 'Habitacion',
              adults: '1',
              children: '0',
              children_ages: '',
              checkin: '2026-12-01',
              checkout: '2026-12-02',
              currency: 'COP',
              id: '0',
              quantity: '1',
              rateId: '0',
              unitaryPrice: 100000,
            },
          ],
        },
        reservaChatbotId: `RES-ROUTE-${Date.now()}`,
        reservaProvider: 'mytool',
        titularInfo: {
          firstName: 'Route',
          lastName: 'Test',
          tipoDocumento: 'CC',
          documento: '9999999999',
          fechaNacimiento: '1990-01-01',
        },
        fechaLimitePago: '2026-11-25',
        status: ValidPaymentStatus.espera,
      });

      const res = await request(app.getHttpServer())
        .post('/agencias/v1/reservas/mytool/cancelar')
        .send({ reservaId: reserva._id.toString() });

      expect(res.body.message ?? '').not.toContain('no es valido');
      expect(res.body.msg).toContain('cancelada');
    });

    it('GET mytool/:hotelSlug/mappings funciona después de la ruta cancelar', async () => {
      await request(app.getHttpServer())
        .get('/agencias/v1/reservas/mytool/aixo/mappings')
        .expect(200);
    });

    it('GET mytool/:hotelSlug/buscar funciona correctamente', async () => {
      await request(app.getHttpServer())
        .get('/agencias/v1/reservas/mytool/aixo/buscar')
        .query({ localizador: 'X', nombre: 'Y' })
        .expect(200);
    });
  });

  // ─────────────────────────────────────────────
  // Hotel slugs válidos
  // ─────────────────────────────────────────────
  describe('Validación de hotel slugs (ParseHotelSlugPipe)', () => {
    const validSlugs = [
      'aixo', 'azuan', 'avexi', 'marina', 'bocagrande',
      'abi', 'boquilla', 'madisson', 'windsor', 'rodadero',
      'axis', 'marques', 'sansiraka', 'playasalguero',
    ];

    validSlugs.forEach((slug) => {
      it(`debe aceptar hotel slug válido: ${slug}`, async () => {
        const res = await request(app.getHttpServer())
          .get(`/agencias/v1/reservas/mytool/${slug}/mappings`);

        expect(res.status).not.toBe(400);
      });
    });

    it('debe rechazar slug con mayúsculas (normaliza a lowercase)', async () => {
      const res = await request(app.getHttpServer())
        .get('/agencias/v1/reservas/mytool/AIXO/mappings');

      expect(res.status).toBe(200);
    });

    it('debe rechazar slug totalmente inválido', async () => {
      const res = await request(app.getHttpServer())
        .get('/agencias/v1/reservas/mytool/noexiste/mappings')
        .expect(400);

      expect(res.body.message).toContain('Hoteles disponibles');
    });
  });
});
