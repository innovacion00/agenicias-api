/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * PR-2.1 — Tests de las 10 divergencias de los métodos de búsqueda/listado de
 * reservas (ver docs/planes/fase2-diff-busquedas.md, sección "Divergencias que
 * deben volverse tests").
 *
 * Se ejecutan contra los métodos públicos de ReservasService (que tras el
 * refactor quedan como wrappers finos sobre ReservasSearchService), de modo que
 * el spec valida que el contrato observable NO cambia con la unificación.
 *
 * IMPORTANTE — cómo correrlo:
 * el config de jest del package.json (rootDir: "src") no resuelve los imports
 * absolutos 'src/...' del código, por lo que hay que inyectar un
 * moduleNameMapper por CLI (sin tocar package.json, fuera del alcance de esta PR):
 *
 *   MONGOMS_VERSION=8.2.1 npx jest --config '{
 *     "rootDir": ".", "testEnvironment": "node",
 *     "moduleFileExtensions": ["js", "json", "ts"],
 *     "transform": { "^.+\\.(t|j)s$": "ts-jest" },
 *     "testRegex": "reservas-search\\.service\\.spec\\.ts$",
 *     "moduleNameMapper": { "^src/(.*)$": "<rootDir>/src/$1" }
 *   }'
 */
import { BadRequestException } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Env dummy ANTES de requerir cualquier módulo de src/ : importar 'src/config'
// dispara la validación Joi de envs.ts (ver src/config/envs.ts).
// ---------------------------------------------------------------------------
const DUMMY = 'dummy';
const ENV_DUMMY: Record<string, string> = {
  PORT: '3000',
  MONGO_URL: 'mongodb://127.0.0.1:27017/dummy-no-usado',
  JWT_SECRET: 'dummy-jwt-secret-spec',
  COBRE_API_URL: 'http://localhost:0/cobre',
  COBRE_USER_ID: DUMMY,
  COBRE_SECRET: DUMMY,
  COBRE_AUTH_STRING: DUMMY,
  COBRE_API_KEY: DUMMY,
  CLOUDINARY_NAME: DUMMY,
  CLOUDINARY_API_KEY: DUMMY,
  CLOUDINARY_API_SECRET: DUMMY,
  SENDER_EMAIL: 'noreply@example.com',
  EMAIL_APP_PASSWORD: DUMMY,
  SENDGRID_API_KEY: DUMMY,
  GOOGLE_GMAIL_API_KEY: DUMMY,
  GOOGLE_GMAIL_URL: 'http://localhost:0/gmail',
  GOOGLE_GMAIL_CLIENT_ID: DUMMY,
  GOOGLE_GMAIL_CLIENT_SECRET: DUMMY,
  GOOGLE_GMAIL_REFRESH_TOKEN: DUMMY,
  AUTOCORE_URL: 'http://localhost:0/autocore',
  AUTOCORE_ACCESS_KEY: DUMMY,
  AUTOCORE_SECRET_KEY: DUMMY,
  MY_TOOL_EMAIL: 'mytool@example.com',
  MY_TOOL_CLAVE: DUMMY,
  API_AIXO: DUMMY,
  API_AZUAN: DUMMY,
  API_RODADERO: DUMMY,
  API_AVEXI: DUMMY,
  API_BOCAGRANADE: DUMMY,
  API_ABI: DUMMY,
  API_MADISSON: DUMMY,
  API_WINDSOR: DUMMY,
  API_MARINA: DUMMY,
  API_AXIS: DUMMY,
  API_MARQUES: DUMMY,
  API_SANSIRAKA: DUMMY,
  API_PLAYASALGUERO: DUMMY,
  AMADEUS_API_KEY: DUMMY,
  AMADEUS_API_SECRET: DUMMY,
  AMADEUS_BASE_URL: 'http://localhost:0/amadeus',
  BOOKING_PERSONAS_TOKEN: DUMMY,
  MAARLAB_BASE_URL: 'http://localhost:0/maarlab',
  HOST_BRIDGE: 'http://localhost:0/bridge',
};
for (const [clave, valor] of Object.entries(ENV_DUMMY)) {
  process.env[clave] = process.env[clave] || valor;
}

// Requeridos DESPUÉS de inyectar el env dummy (los import de arriba se izan).
const { ReservasService } = require('../reservas.service');
const { ReservasController } = require('../reservas.controller');
const { ReservaSchema } = require('../entities');
const { UserSchema } = require('../../auth/entities');
const { AgenciaSchema } = require('../../agencias/entities');

jest.setTimeout(120000);

// ---------------------------------------------------------------------------
// Infraestructura: Mongo en memoria + modelos + seed
// ---------------------------------------------------------------------------
let mongod: MongoMemoryServer;
let conexion: mongoose.Connection;
let agenciaModel: mongoose.Model<any>;
let userModel: mongoose.Model<any>;
let reservaModel: mongoose.Model<any>;

// Ids del seed (ver beforeAll)
const ids = {
  agenciaAlfa: new mongoose.Types.ObjectId(),
  agenciaBeta: new mongoose.Types.ObjectId(),
  agenciaEspecial: new mongoose.Types.ObjectId(),
  superAdmin: new mongoose.Types.ObjectId(),
  adminAlfa: new mongoose.Types.ObjectId(),
  userAlfa: new mongoose.Types.ObjectId(), // fullName 'juan+garcia (s.a.)'
  adminBeta: new mongoose.Types.ObjectId(),
  userEspecial: new mongoose.Types.ObjectId(),
};

const ROLES = {
  superAdmin: ['super-admin'],
  admin: ['admin'],
  user: ['user'],
};

function reservaSeed(extra: Record<string, any>) {
  return {
    hotel: 'Hotel Generico',
    cantidadHabitaciones: 1,
    total: 100,
    status: 0,
    fechaLimitePago: '2026-12-31',
    reservation: {
      adults: '2',
      checkin: '2026-01-10',
      checkout: '2026-01-12',
      city: 'Santa Marta',
      country: 'CO',
      currency: 'COP',
      email: 'huesped@example.com',
      telephone: '+573000000000',
      firstName: 'Huesped',
      lastName: 'Generico',
      nights: '2',
      rooms: '1',
      roomsData: [],
    },
    ...extra,
  };
}

async function seed() {
  await agenciaModel.create([
    {
      _id: ids.agenciaAlfa,
      emailContacto: 'alfa@example.com',
      telefonoContacto: '+573001110001',
      fullName: 'agencia alfa',
      slug: 'agencia-alfa',
      category: 1,
      documentInfo: { tipo: 'NIT', document: '900000001' },
      cobreInfo: { bolcilloId: 'b-alfa' },
    },
    {
      _id: ids.agenciaBeta,
      emailContacto: 'beta@example.com',
      telefonoContacto: '+573001110002',
      fullName: 'agencia beta',
      slug: 'agencia-beta',
      category: 0,
      documentInfo: { tipo: 'NIT', document: '900000002' },
      cobreInfo: { bolcilloId: 'b-beta' },
    },
    {
      _id: ids.agenciaEspecial,
      // Nombre con metacaracteres de regex (caso 4 del diff — fix intencional)
      emailContacto: 'especial@example.com',
      telefonoContacto: '+573001110003',
      fullName: 'agencia+especial (s.a.)',
      slug: 'agencia-especial',
      category: 1,
      documentInfo: { tipo: 'NIT', document: '900000003' },
      cobreInfo: { bolcilloId: 'b-especial' },
    },
  ]);

  await userModel.create([
    {
      _id: ids.superAdmin,
      email: 'sofia@example.com',
      password: 'x',
      telefono: '+573002220001',
      fullName: 'sofia superadmin',
      role: ['super-admin'],
      agencia: ids.agenciaAlfa,
    },
    {
      _id: ids.adminAlfa,
      email: 'carlos@example.com',
      password: 'x',
      telefono: '+573002220002',
      fullName: 'carlos admin alfa',
      role: ['admin'],
      agencia: ids.agenciaAlfa,
    },
    {
      _id: ids.userAlfa,
      email: 'juan@example.com',
      password: 'x',
      telefono: '+573002220003',
      // Nombre con metacaracteres de regex (caso 4 del diff — fix intencional)
      fullName: 'juan+garcia (s.a.)',
      role: ['user'],
      agencia: ids.agenciaAlfa,
    },
    {
      _id: ids.adminBeta,
      email: 'pedro@example.com',
      password: 'x',
      telefono: '+573002220004',
      fullName: 'pedro admin beta',
      role: ['admin'],
      agencia: ids.agenciaBeta,
    },
    {
      _id: ids.userEspecial,
      email: 'lucia@example.com',
      password: 'x',
      telefono: '+573002220005',
      fullName: 'lucia especial',
      role: ['user'],
      agencia: ids.agenciaEspecial,
    },
  ]);

  // 5 reservas: totales 100..500 para verificar sumas agregadas.
  // No canceladas: 100+200+300+400 = 1000 (r5 está cancelada, status 4).
  await reservaModel.create(
    reservaSeed({
      userId: ids.userAlfa,
      agenciaId: ids.agenciaAlfa,
      hotel: 'Hotel Aixo',
      total: 100,
      status: 0,
      reservaChatbotId: 'CHAT-001',
      reservation: {
        ...reservaSeed({}).reservation,
        firstName: 'Maria',
        lastName: 'Lopez',
        checkin: '2026-01-10',
      },
    }),
  );
  await reservaModel.create(
    reservaSeed({
      userId: ids.userAlfa,
      agenciaId: ids.agenciaAlfa,
      hotel: 'Hotel Aixo',
      total: 200,
      status: 3,
      reservaChatbotId: 'CHAT-002',
      reservation: {
        ...reservaSeed({}).reservation,
        firstName: 'Ana+Maria',
        lastName: 'Diaz',
        checkin: '2026-02-15',
      },
    }),
  );
  await reservaModel.create(
    reservaSeed({
      userId: ids.adminAlfa,
      agenciaId: ids.agenciaAlfa,
      hotel: 'Hotel Windsor',
      total: 300,
      status: 0,
      reservaChatbotId: 'CHAT-003',
      reservation: {
        ...reservaSeed({}).reservation,
        firstName: 'Carlos',
        lastName: 'Perez',
        checkin: '2026-03-01',
      },
    }),
  );
  await reservaModel.create(
    reservaSeed({
      userId: ids.adminBeta,
      agenciaId: ids.agenciaBeta,
      hotel: 'Hotel Madisson',
      total: 400,
      status: 0,
      reservaChatbotId: 'CHAT-004',
      reservation: {
        ...reservaSeed({}).reservation,
        firstName: 'Maria',
        lastName: 'Lopez',
        checkin: '2026-03-20',
      },
    }),
  );
  await reservaModel.create(
    reservaSeed({
      userId: ids.userEspecial,
      agenciaId: ids.agenciaEspecial,
      hotel: 'Hotel Marina',
      total: 500,
      status: 4, // cancelada
      reservaChatbotId: 'CHAT-005',
      reservation: {
        ...reservaSeed({}).reservation,
        firstName: 'Luis',
        lastName: 'Gomez',
        checkin: '2026-04-05',
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Factory del servicio bajo prueba.
// Antes del refactor: ReservasService con sus 8 dependencias actuales.
// Después del refactor: se le añade ReservasSearchService (wrappers finos);
// el try/catch hace que el MISMO spec corra verde en ambos estados.
// ---------------------------------------------------------------------------
function crearMocks() {
  return {
    emailService: { sendEmail: jest.fn() },
    httpCustomService: {},
    cancellationTasksQueueService: {},
    myToolBookingService: { searchBooking: jest.fn() },
  };
}

function crearReservasService() {
  const mocks = crearMocks();
  const argsExtra: any[] = [];
  try {
    // Servicios nuevos de PR-2.1 (no existen antes del refactor).
    const {
      ReservasCountCacheService,
    } = require('./reservas-count-cache.service');
    const { ReservasSearchService } = require('./reservas-search.service');
    const countCache = new ReservasCountCacheService(reservaModel);
    const searchService = new ReservasSearchService(
      agenciaModel,
      userModel,
      reservaModel,
      countCache,
      mocks.myToolBookingService,
    );
    argsExtra.push(searchService);
  } catch {
    // Antes del refactor: ReservasService implementa las búsquedas inline.
  }

  const service = new ReservasService(
    agenciaModel,
    userModel,
    reservaModel,
    mocks.emailService,
    mocks.httpCustomService,
    mocks.cancellationTasksQueueService,
    mocks.myToolBookingService,
    conexion,
    ...argsExtra,
  );
  return { service, mocks };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  conexion = mongoose.createConnection(mongod.getUri());
  await conexion.asPromise();
  agenciaModel = conexion.model('Agencia', AgenciaSchema);
  userModel = conexion.model('User', UserSchema);
  reservaModel = conexion.model('Reserva', ReservaSchema);
  await seed();
});

afterAll(async () => {
  await conexion.close();
  await mongod.stop();
});

// ---------------------------------------------------------------------------
// Divergencias 1 y 7 — buscarPorChatbotId: contrato propio { data, found,
// sumaTotales } con data nullable y sumaTotales = total de UNA reserva.
// ---------------------------------------------------------------------------
describe('buscarPorChatbotId (divergencias 1 y 7)', () => {
  let service: any;
  beforeEach(() => ({ service } = crearReservasService()));

  it('encontrada: retorna { data, found: true } y sumaTotales = total de ESA reserva (no la suma del filtro de rol)', async () => {
    const res = await service.buscarPorChatbotId(
      'CHAT-001',
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
    );
    expect(res.found).toBe(true);
    expect(res.data).not.toBeNull();
    expect(res.data.reservaChatbotId).toBe('CHAT-001');
    // Divergencia 7: total de UN doc (100), no la suma agregada (1500).
    expect(res.sumaTotales).toBe(100);
  });

  it('no encontrada: retorna exactamente { data: null, found: false, sumaTotales: 0 }', async () => {
    const res = await service.buscarPorChatbotId(
      'NO-EXISTE',
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
    );
    expect(res).toEqual({ data: null, found: false, sumaTotales: 0 });
  });

  it('rol user: no encuentra reservas de otros usuarios (filtro construirFiltroPorRol)', async () => {
    const res = await service.buscarPorChatbotId(
      'CHAT-004', // reserva de agenciaBeta
      ids.userAlfa,
      ids.agenciaAlfa,
      ROLES.user,
    );
    expect(res).toEqual({ data: null, found: false, sumaTotales: 0 });
  });

  it('rol admin: sí encuentra reservas de su agencia', async () => {
    const res = await service.buscarPorChatbotId(
      'CHAT-001',
      ids.adminAlfa,
      ids.agenciaAlfa,
      ROLES.admin,
    );
    expect(res.found).toBe(true);
    expect(res.sumaTotales).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// buscarPorNombreAgente — divergencias 2, 3, 4 (fix), 5 y 8
// ---------------------------------------------------------------------------
describe('buscarPorNombreAgente', () => {
  let service: any;
  beforeEach(() => ({ service } = crearReservasService()));

  it('divergencia 2: 0 usuarios coincidentes hace early-exit con meta { total: 0, page: 1, pageSize: 15, totalPages: 0 }', async () => {
    const res = await service.buscarPorNombreAgente(
      'zzz inexistente',
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
    );
    expect(res).toEqual({
      data: [],
      meta: { total: 0, page: 1, pageSize: 15, totalPages: 0 },
    });
  });

  it('divergencia 2 + 5: early-exit con all=true omite page/pageSize/totalPages', async () => {
    const res = await service.buscarPorNombreAgente(
      'zzz inexistente',
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
      1,
      true,
    );
    expect(res).toEqual({ data: [], meta: { total: 0 } });
  });

  it('divergencia 3: admin filtra User.agencia — no ve agentes de otra agencia', async () => {
    const res = await service.buscarPorNombreAgente(
      'pedro', // agente de agenciaBeta
      ids.adminAlfa,
      ids.agenciaAlfa,
      ROLES.admin,
    );
    expect(res.meta.total).toBe(0);
    expect(res.data).toEqual([]);
  });

  it('divergencia 3: user filtra User._id — solo puede buscarse a sí mismo', async () => {
    const otro = await service.buscarPorNombreAgente(
      'carlos', // otro usuario de su misma agencia
      ids.userAlfa,
      ids.agenciaAlfa,
      ROLES.user,
    );
    expect(otro.meta.total).toBe(0);

    const propio = await service.buscarPorNombreAgente(
      'juan',
      ids.userAlfa,
      ids.agenciaAlfa,
      ROLES.user,
    );
    expect(propio.meta.total).toBe(2);
    expect(propio.meta.sumaTotales).toBe(300); // 100 + 200
  });

  // FIX INTENCIONAL (A3 / divergencia 4): antes del refactor el nombre del
  // agente NO se escapaba y este test falla (la regex literal no matchea).
  it('FIX intencional: input con metacaracteres "Juan+Garcia (S.A.)" matchea literal', async () => {
    const res = await service.buscarPorNombreAgente(
      'Juan+Garcia (S.A.)',
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
    );
    expect(res.meta.total).toBe(2); // las 2 reservas de juan+garcia (s.a.)
    expect(res.meta.sumaTotales).toBe(300);
  });

  // FIX INTENCIONAL (A3 / divergencia 4): antes del refactor una regex
  // inválida (paréntesis sin cerrar) reventaba con 500 'Revisar logs'.
  it('FIX intencional: input con regex inválida "Juan+Garcia (" no lanza y retorna 0', async () => {
    const res = await service.buscarPorNombreAgente(
      'Juan+Garcia (',
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
    );
    expect(res.meta.total).toBe(0);
  });

  it('divergencia 5: all=false incluye page/pageSize/totalPages; all=true las omite', async () => {
    const paginado = await service.buscarPorNombreAgente(
      'juan',
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
      1,
      false,
    );
    expect(paginado.meta).toEqual({
      total: 2,
      page: 1,
      pageSize: 15,
      totalPages: 1,
      sumaTotales: 300,
    });

    const todas = await service.buscarPorNombreAgente(
      'juan',
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
      1,
      true,
    );
    expect(todas.meta).toEqual({ total: 2, sumaTotales: 300 });
    expect(todas.data).toHaveLength(2);
  });

  it('divergencia 8: page=10000 capea el skip en MAX_SKIP sin reventar', async () => {
    const res = await service.buscarPorNombreAgente(
      'juan',
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
      10000,
      false,
    );
    expect(res.data).toEqual([]);
    expect(res.meta.page).toBe(10000);
    expect(res.meta.total).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// buscarPorNombreAgencia — divergencias 3, 4 (fix) y 6
// ---------------------------------------------------------------------------
describe('buscarPorNombreAgencia', () => {
  let service: any;
  beforeEach(() => ({ service } = crearReservasService()));

  it('divergencia 3: todo no-superadmin filtra Agencia._id — admin NO ve otras agencias', async () => {
    const res = await service.buscarPorNombreAgencia(
      'agencia beta',
      ids.adminAlfa,
      ids.agenciaAlfa,
      ROLES.admin,
    );
    expect(res).toEqual({
      data: [],
      meta: { total: 0, page: 1, pageSize: 15, totalPages: 0 },
    });
  });

  it('admin sí encuentra su propia agencia', async () => {
    const res = await service.buscarPorNombreAgencia(
      'agencia alfa',
      ids.adminAlfa,
      ids.agenciaAlfa,
      ROLES.admin,
    );
    expect(res.meta.total).toBe(3); // CHAT-001..003
    expect(res.meta.sumaTotales).toBe(600);
  });

  it('divergencia 6: super-admin busca en TODAS las agencias', async () => {
    const res = await service.buscarPorNombreAgencia(
      'agencia',
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
    );
    expect(res.meta.total).toBe(5); // todas las reservas del seed
    expect(res.meta.sumaTotales).toBe(1500);
  });

  // FIX INTENCIONAL (A3 / divergencia 4): antes del refactor el nombre de la
  // agencia NO se escapaba y este test falla.
  it('FIX intencional: "Agencia+Especial (S.A.)" matchea literal', async () => {
    const res = await service.buscarPorNombreAgencia(
      'Agencia+Especial (S.A.)',
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
    );
    expect(res.meta.total).toBe(1); // CHAT-005
    expect(res.meta.sumaTotales).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// buscarPorNombreHuesped — normalización + escape (ya existentes: deben
// conservarse tal cual tras la unificación)
// ---------------------------------------------------------------------------
describe('buscarPorNombreHuesped', () => {
  let service: any;
  beforeEach(() => ({ service } = crearReservasService()));

  it('normaliza espacios: "  Maria   Lopez " encuentra firstName+lastName', async () => {
    const res = await service.buscarPorNombreHuesped(
      '  Maria   Lopez ',
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
    );
    expect(res.meta.total).toBe(2); // CHAT-001 y CHAT-004
    expect(res.meta.sumaTotales).toBe(500);
  });

  it('ya escapaba metacaracteres: "Ana+Maria" matchea literal (verde antes y después)', async () => {
    const res = await service.buscarPorNombreHuesped(
      'Ana+Maria',
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
    );
    expect(res.meta.total).toBe(1); // CHAT-002
    expect(res.meta.sumaTotales).toBe(200);
  });

  it('usa construirFiltroPorRol: user solo ve sus propias reservas', async () => {
    const propio = await service.buscarPorNombreHuesped(
      'Maria Lopez',
      ids.userAlfa,
      ids.agenciaAlfa,
      ROLES.user,
    );
    expect(propio.meta.total).toBe(1); // solo CHAT-001

    const ajeno = await service.buscarPorNombreHuesped(
      'Maria Lopez',
      ids.userEspecial,
      ids.agenciaEspecial,
      ROLES.user,
    );
    expect(ajeno.meta.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buscarPorEstado + populate exacto
// ---------------------------------------------------------------------------
describe('buscarPorEstado', () => {
  let service: any;
  beforeEach(() => ({ service } = crearReservasService()));

  it('super-admin: filtro exacto por status con suma agregada', async () => {
    const res = await service.buscarPorEstado(
      0,
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
    );
    expect(res.meta.total).toBe(3); // CHAT-001, 003, 004
    expect(res.meta.sumaTotales).toBe(800);
  });

  it('admin: solo reservas de su agencia', async () => {
    const res = await service.buscarPorEstado(
      0,
      ids.adminAlfa,
      ids.agenciaAlfa,
      ROLES.admin,
    );
    expect(res.meta.total).toBe(2); // CHAT-001 y CHAT-003
    expect(res.meta.sumaTotales).toBe(400);
  });

  it('divergencia 5: all=true retorna meta { total, sumaTotales } sin paginación', async () => {
    const res = await service.buscarPorEstado(
      4,
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
      1,
      true,
    );
    expect(res.meta).toEqual({ total: 1, sumaTotales: 500 });
  });

  it('populate exacto: agenciaId(fullName _id emailContacto) y userId(fullName email)', async () => {
    const res = await service.buscarPorEstado(
      4,
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
    );
    const reserva = res.data[0];
    expect(Object.keys(reserva.agenciaId).sort()).toEqual([
      '_id',
      'emailContacto',
      'fullName',
    ]);
    expect(Object.keys(reserva.userId).sort()).toEqual([
      '_id',
      'email',
      'fullName',
    ]);
  });
});

// ---------------------------------------------------------------------------
// getReservasByUser / getReservasByAgencia (listados con buildIdFilter)
// ---------------------------------------------------------------------------
describe('getReservasByUser', () => {
  let service: any;
  beforeEach(() => ({ service } = crearReservasService()));

  it('retorna las reservas del usuario con meta paginada (sin sumaTotales)', async () => {
    const res = await service.getReservasByUser(ids.userAlfa, 1);
    expect(res.data).toHaveLength(2);
    expect(res.meta).toEqual({
      total: 2,
      page: 1,
      pageSize: 15,
      totalPages: 1,
    });
  });

  it('acepta el userId como string (buildIdFilter legacy)', async () => {
    const res = await service.getReservasByUser(ids.userAlfa.toString(), 1);
    expect(res.meta.total).toBe(2);
  });

  it('userId inválido lanza BadRequestException("ID de usuario inválido")', async () => {
    await expect(service.getReservasByUser('no-es-un-id', 1)).rejects.toThrow(
      new BadRequestException('ID de usuario inválido'),
    );
  });
});

describe('getReservasByAgencia', () => {
  let service: any;
  beforeEach(() => ({ service } = crearReservasService()));

  it('retorna las reservas de la agencia con su populate propio (agenciaId SIN emailContacto)', async () => {
    const res = await service.getReservasByAgencia(ids.agenciaAlfa, 1);
    expect(res.data).toHaveLength(3);
    expect(res.meta).toEqual({
      total: 3,
      page: 1,
      pageSize: 15,
      totalPages: 1,
    });
    const reserva = res.data[0];
    expect(Object.keys(reserva.agenciaId).sort()).toEqual(['_id', 'fullName']);
    expect(Object.keys(reserva.userId).sort()).toEqual([
      '_id',
      'email',
      'fullName',
    ]);
  });
});

// ---------------------------------------------------------------------------
// getAllReservas (administración)
// ---------------------------------------------------------------------------
describe('getAllReservas', () => {
  let service: any;
  beforeEach(() => ({ service } = crearReservasService()));

  it('sin filtros: pagina y agrega sumaTotalesNoCanceladas (excluye status 4)', async () => {
    const res = await service.getAllReservas(1, false);
    expect(res.meta.total).toBe(5);
    expect(res.meta.page).toBe(1);
    expect(res.meta.pageSize).toBe(15);
    expect(res.meta.totalPages).toBe(1);
    expect(res.meta.sumaTotalesNoCanceladas).toBe(1000); // 1500 - 500 cancelada
  });

  it('filtro hotel: regex parcial case-insensitive + meta.hotelFiltrado', async () => {
    const res = await service.getAllReservas(1, false, 'aixo');
    expect(res.meta.total).toBe(2);
    expect(res.meta.hotelFiltrado).toBe('aixo');
  });

  it('filtro nombreAgencia: matchea por query previa sobre Agencia', async () => {
    const res = await service.getAllReservas(1, false, undefined, 'beta');
    expect(res.meta.total).toBe(1);
    expect(res.meta.nombreAgenciaFiltrado).toBe('beta');
  });

  it('nombreAgencia sin coincidencias: early-exit con forma exacta del meta', async () => {
    const res = await service.getAllReservas(1, false, undefined, 'noexiste');
    expect(res).toEqual({
      data: [],
      meta: {
        total: 0,
        page: 1,
        pageSize: 15,
        totalPages: 0,
        sumaTotalesNoCanceladas: 0,
        nombreAgenciaFiltrado: 'noexiste',
      },
    });
  });

  it('fechaDesde sola filtra el día exacto del checkin', async () => {
    const res = await service.getAllReservas(
      1,
      false,
      undefined,
      undefined,
      '2026-03-01',
    );
    expect(res.meta.total).toBe(1); // solo CHAT-003
    expect(res.meta.fechaDesde).toBe('2026-03-01');
  });

  it('fechaDesde + fechaHasta filtran por rango de checkin', async () => {
    const res = await service.getAllReservas(
      1,
      false,
      undefined,
      undefined,
      '2026-02-01',
      '2026-03-31',
    );
    expect(res.meta.total).toBe(3); // CHAT-002, 003, 004
  });

  it('all=true omite la paginación del meta', async () => {
    const res = await service.getAllReservas(1, true);
    expect(res.data).toHaveLength(5);
    expect(res.meta).toEqual({
      total: 5,
      sumaTotalesNoCanceladas: 1000,
    });
  });
});

// ---------------------------------------------------------------------------
// Caché de counts (TTL 60 s): el total queda cacheado por filtro
// ---------------------------------------------------------------------------
describe('caché de counts (TTL)', () => {
  it('reusa el total cacheado dentro del TTL aunque entren documentos nuevos', async () => {
    const { service } = crearReservasService();

    const antes = await service.buscarPorEstado(
      0,
      ids.superAdmin,
      ids.agenciaAlfa,
      ROLES.superAdmin,
    );
    expect(antes.meta.total).toBe(3);

    await reservaModel.create(
      reservaSeed({
        userId: ids.userAlfa,
        agenciaId: ids.agenciaAlfa,
        total: 50,
        status: 0,
        reservaChatbotId: 'CHAT-006',
      }),
    );

    try {
      const despues = await service.buscarPorEstado(
        0,
        ids.superAdmin,
        ids.agenciaAlfa,
        ROLES.superAdmin,
      );
      // data sí refleja el doc nuevo; el count viene del caché (TTL 60 s)
      expect(despues.data).toHaveLength(4);
      expect(despues.meta.total).toBe(3);
    } finally {
      await reservaModel.deleteOne({ reservaChatbotId: 'CHAT-006' });
    }
  });
});

// ---------------------------------------------------------------------------
// searchReservaMyTool: delegación pura en MyToolBookingService
// ---------------------------------------------------------------------------
describe('searchReservaMyTool', () => {
  it('delega en myToolBookingService.searchBooking con los mismos argumentos', async () => {
    const { service, mocks } = crearReservasService();
    const sentinel = { bookings: [] };
    mocks.myToolBookingService.searchBooking.mockResolvedValue(sentinel);

    const res = await service.searchReservaMyTool('aixo', 'LOC-1', 'maria');

    expect(mocks.myToolBookingService.searchBooking).toHaveBeenCalledWith(
      'aixo',
      'LOC-1',
      'maria',
    );
    expect(res).toBe(sentinel);
  });
});

// ---------------------------------------------------------------------------
// Divergencias 9 y 10 — wiring del controller intacto (5 rutas de búsqueda)
// ---------------------------------------------------------------------------
describe('ReservasController — wiring de las 5 rutas de búsqueda (divergencias 9 y 10)', () => {
  const usuario: any = { role: ['admin'] };
  const userId: any = ids.adminAlfa;
  const agenciaId: any = ids.agenciaAlfa;
  let serviceMock: any;
  let controller: any;

  beforeEach(() => {
    serviceMock = {
      buscarPorChatbotId: jest.fn().mockResolvedValue('ok'),
      buscarPorNombreAgente: jest.fn().mockResolvedValue('ok'),
      buscarPorNombreAgencia: jest.fn().mockResolvedValue('ok'),
      buscarPorNombreHuesped: jest.fn().mockResolvedValue('ok'),
      buscarPorEstado: jest.fn().mockResolvedValue('ok'),
    };
    controller = new ReservasController(serviceMock);
  });

  it('GET buscar/chatbot-id delega con (id, userId, agenciaId, roles)', () => {
    controller.buscarPorChatbotId('CHAT-001', userId, agenciaId, usuario);
    expect(serviceMock.buscarPorChatbotId).toHaveBeenCalledWith(
      'CHAT-001',
      userId,
      agenciaId,
      usuario.role,
    );
  });

  it('GET buscar/chatbot-id sin parámetro lanza 400', () => {
    expect(() =>
      controller.buscarPorChatbotId(undefined, userId, agenciaId, usuario),
    ).toThrow(BadRequestException);
  });

  it('GET buscar/agente delega y convierte all ("true"/"1" → true, resto → false)', () => {
    controller.buscarPorNombreAgente(
      'juan',
      2,
      'true',
      userId,
      agenciaId,
      usuario,
    );
    expect(serviceMock.buscarPorNombreAgente).toHaveBeenCalledWith(
      'juan',
      userId,
      agenciaId,
      usuario.role,
      2,
      true,
    );

    controller.buscarPorNombreAgente(
      'juan',
      1,
      undefined,
      userId,
      agenciaId,
      usuario,
    );
    expect(serviceMock.buscarPorNombreAgente).toHaveBeenLastCalledWith(
      'juan',
      userId,
      agenciaId,
      usuario.role,
      1,
      false,
    );
  });

  it('GET buscar/agente sin nombre lanza 400', () => {
    expect(() =>
      controller.buscarPorNombreAgente(
        undefined,
        1,
        undefined,
        userId,
        agenciaId,
        usuario,
      ),
    ).toThrow(BadRequestException);
  });

  it('GET buscar/agencia delega con la firma intacta', () => {
    controller.buscarPorNombreAgencia(
      'alfa',
      1,
      '1',
      userId,
      agenciaId,
      usuario,
    );
    expect(serviceMock.buscarPorNombreAgencia).toHaveBeenCalledWith(
      'alfa',
      userId,
      agenciaId,
      usuario.role,
      1,
      true,
    );
  });

  it('GET buscar/huesped delega con la firma intacta', () => {
    controller.buscarPorNombreHuesped(
      'maria',
      3,
      'no',
      userId,
      agenciaId,
      usuario,
    );
    expect(serviceMock.buscarPorNombreHuesped).toHaveBeenCalledWith(
      'maria',
      userId,
      agenciaId,
      usuario.role,
      3,
      false,
    );
  });

  it('GET buscar/estado parsea el status y delega', () => {
    controller.buscarPorEstado('4', 1, undefined, userId, agenciaId, usuario);
    expect(serviceMock.buscarPorEstado).toHaveBeenCalledWith(
      4,
      userId,
      agenciaId,
      usuario.role,
      1,
      false,
    );
  });

  it('divergencia 9: estado fuera de [0–6] o no numérico lanza 400', () => {
    for (const invalido of ['7', '-1', 'abc']) {
      expect(() =>
        controller.buscarPorEstado(
          invalido,
          1,
          undefined,
          userId,
          agenciaId,
          usuario,
        ),
      ).toThrow(BadRequestException);
    }
    expect(() =>
      controller.buscarPorEstado(
        undefined,
        1,
        undefined,
        userId,
        agenciaId,
        usuario,
      ),
    ).toThrow(BadRequestException);
  });
});
