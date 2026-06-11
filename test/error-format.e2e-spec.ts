import {
  ArgumentsHost,
  HttpException,
  INestApplication,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { GlobalExceptionFilter } from '../src/common/filters';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Variables dummy para TODAS las vars requeridas por el Joi schema de
 * src/config/envs.ts (mismo set que .claude/skills/run-agencias-api/driver.mjs)
 * para poder levantar el AppModule COMPLETO sin .env ni servicios reales.
 */
function aplicarEnvsDummy(mongoUrl: string): void {
  const s = 'dummy';
  const envsDummy: Record<string, string> = {
    PORT: '3000',
    MONGO_URL: mongoUrl,
    JWT_SECRET: 'dummy-jwt-secret-for-e2e',
    COBRE_API_URL: 'http://localhost:0/cobre',
    COBRE_USER_ID: s,
    COBRE_SECRET: s,
    COBRE_AUTH_STRING: s,
    COBRE_API_KEY: s,
    CLOUDINARY_NAME: s,
    CLOUDINARY_API_KEY: s,
    CLOUDINARY_API_SECRET: s,
    SENDER_EMAIL: 'noreply@example.com',
    EMAIL_APP_PASSWORD: s,
    SENDGRID_API_KEY: s,
    GOOGLE_GMAIL_API_KEY: s,
    GOOGLE_GMAIL_URL: 'http://localhost:0/gmail',
    GOOGLE_GMAIL_CLIENT_ID: s,
    GOOGLE_GMAIL_CLIENT_SECRET: s,
    GOOGLE_GMAIL_REFRESH_TOKEN: s,
    AUTOCORE_URL: 'http://localhost:0/autocore',
    AUTOCORE_ACCESS_KEY: s,
    AUTOCORE_SECRET_KEY: s,
    MY_TOOL_EMAIL: 'mytool@example.com',
    MY_TOOL_CLAVE: s,
    API_AIXO: s,
    API_AZUAN: s,
    API_RODADERO: s,
    API_AVEXI: s,
    API_BOCAGRANADE: s,
    API_ABI: s,
    API_MADISSON: s,
    API_WINDSOR: s,
    API_MARINA: s,
    API_AXIS: s,
    API_MARQUES: s,
    API_SANSIRAKA: s,
    API_PLAYASALGUERO: s,
    AMADEUS_API_KEY: s,
    AMADEUS_API_SECRET: s,
    AMADEUS_BASE_URL: 'http://localhost:0/amadeus',
    BOOKING_PERSONAS_TOKEN: s,
    MAARLAB_BASE_URL: 'http://localhost:0/maarlab',
    HOST_BRIDGE: 'http://localhost:0/bridge',
    // 'production' evita el transport pino-pretty (worker threads) bajo jest
    NODE_ENV: 'production',
  };
  Object.assign(process.env, envsDummy);
}

// ═══════════════════════════════════════════════════════════
// E2E: app COMPLETA (AppModule) + prefijo y ValidationPipe de main.ts
// ═══════════════════════════════════════════════════════════
describe('Formato global de errores (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

    // Las envs dummy deben existir ANTES de importar AppModule, porque
    // src/config/envs.ts valida process.env con Joi al cargarse el módulo.
    aplicarEnvsDummy(mongod.getUri());
    const { AppModule } = await import('../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mismo prefijo y mismo ValidationPipe que src/main.ts
    app.setGlobalPrefix('agencias/v1/');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  it('GET a ruta inexistente -> 404 Nest estándar + correlationId/timestamp/path', async () => {
    const res = await request(app.getHttpServer())
      .get('/agencias/v1/ruta-que-no-existe')
      .expect(404);

    // Lo que Nest produce hoy, intacto
    expect(res.body.statusCode).toBe(404);
    expect(res.body.message).toBe('Cannot GET /agencias/v1/ruta-que-no-existe');
    expect(res.body.error).toBe('Not Found');

    // Los 3 campos nuevos del superset
    expect(res.body.correlationId).toMatch(UUID_REGEX);
    expect(res.body.timestamp).toMatch(ISO_REGEX);
    expect(res.body.path).toBe('/agencias/v1/ruta-que-no-existe');
  });

  it('POST auth/sign-in con body vacío -> 400 y message sigue siendo string[]', async () => {
    const res = await request(app.getHttpServer())
      .post('/agencias/v1/auth/sign-in')
      .send({})
      .expect(400);

    expect(res.body.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');

    // El array del ValidationPipe queda IDÉNTICO (no se aplana ni renombra)
    expect(Array.isArray(res.body.message)).toBe(true);
    expect(res.body.message.length).toBeGreaterThan(0);
    for (const m of res.body.message) {
      expect(typeof m).toBe('string');
    }

    expect(res.body.correlationId).toMatch(UUID_REGEX);
    expect(res.body.timestamp).toMatch(ISO_REGEX);
    expect(res.body.path).toBe('/agencias/v1/auth/sign-in');
  });

  it('cada request recibe un correlationId distinto (genReqId real, no contador)', async () => {
    const res1 = await request(app.getHttpServer())
      .get('/agencias/v1/ruta-que-no-existe')
      .expect(404);
    const res2 = await request(app.getHttpServer())
      .get('/agencias/v1/ruta-que-no-existe')
      .expect(404);

    expect(res1.body.correlationId).toMatch(UUID_REGEX);
    expect(res2.body.correlationId).toMatch(UUID_REGEX);
    expect(res1.body.correlationId).not.toBe(res2.body.correlationId);
  });

  it('ruta de vuelos conserva su formato propio { success: false, ... } (filtro local gana)', async () => {
    const res = await request(app.getHttpServer())
      .post('/agencias/v1/vuelos/disponibilidad')
      .send({})
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.statusCode).toBe(400);
    // El formato del filtro de vuelos NO recibe los campos del filtro global
    expect(res.body).not.toHaveProperty('correlationId');
  });
});

// ═══════════════════════════════════════════════════════════
// Unitario: casos imposibles de forzar vía HTTP (ArgumentsHost mockeado)
// ═══════════════════════════════════════════════════════════
describe('GlobalExceptionFilter (unitario con ArgumentsHost mockeado)', () => {
  const CORRELATION_ID = 'corr-id-de-prueba';

  function crearHostMock() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const requestMock = {
      id: CORRELATION_ID,
      method: 'POST',
      url: '/agencias/v1/agencias',
      originalUrl: '/agencias/v1/agencias',
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => requestMock,
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  }

  function cuerpoEnviado(json: jest.Mock): Record<string, any> {
    expect(json).toHaveBeenCalledTimes(1);
    return json.mock.calls[0][0];
  }

  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('Mongo 11000 -> 400 con message idéntico a ErrorManager + details.duplicateKey', () => {
    const filtro = new GlobalExceptionFilter();
    const { host, status, json } = crearHostMock();
    const errorMongo = { code: 11000, keyValue: { email: 'x@x.com' } };

    filtro.catch(errorMongo, host);

    expect(status).toHaveBeenCalledWith(400);
    const body = cuerpoEnviado(json);
    expect(body.statusCode).toBe(400);
    expect(body.message).toBe('{"email":"x@x.com"} existente en BD');
    expect(body.details).toEqual({ duplicateKey: { email: 'x@x.com' } });
    expect(body.correlationId).toBe(CORRELATION_ID);
    expect(body.timestamp).toMatch(ISO_REGEX);
    expect(body.path).toBe('/agencias/v1/agencias');
  });

  it('Error desconocido -> 500 "Revisar logs"; el detalle NO viaja al cliente', () => {
    const filtro = new GlobalExceptionFilter();
    const { host, status, json } = crearHostMock();

    filtro.catch(new Error('detalle interno secreto'), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = cuerpoEnviado(json);
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Revisar logs');
    expect(body.error).toBe('Internal Server Error');
    expect(JSON.stringify(body)).not.toContain('detalle interno secreto');

    // El 5xx se loguea con stack y el mismo correlationId
    expect(loggerErrorSpy).toHaveBeenCalled();
    const [mensajeLog, stackLog] = loggerErrorSpy.mock.calls[0];
    expect(mensajeLog).toContain(CORRELATION_ID);
    expect(mensajeLog).toContain('detalle interno secreto');
    expect(stackLog).toContain('Error: detalle interno secreto');
  });

  it('AxiosError -> 500 (NO 502); payload del tercero SOLO al log', () => {
    const filtro = new GlobalExceptionFilter();
    const { host, status, json } = crearHostMock();
    const axiosError = Object.assign(new Error('Request failed with 422'), {
      isAxiosError: true,
      config: { method: 'post', url: 'http://autocore/api/reservas' },
      response: { status: 422, data: { detalle: 'payload-del-tercero' } },
    });

    filtro.catch(axiosError, host);

    expect(status).toHaveBeenCalledWith(500);
    const body = cuerpoEnviado(json);
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Revisar logs');
    expect(JSON.stringify(body)).not.toContain('payload-del-tercero');

    // El payload del tercero aparece en el log con el mismo correlationId
    const logs = loggerErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logs).toContain('payload-del-tercero');
    expect(logs).toContain(CORRELATION_ID);
  });

  it('HttpException con respuesta string se envuelve en { statusCode, message } + campos', () => {
    const filtro = new GlobalExceptionFilter();
    const { host, status, json } = crearHostMock();

    filtro.catch(new HttpException('Texto plano', 418), host);

    expect(status).toHaveBeenCalledWith(418);
    const body = cuerpoEnviado(json);
    expect(body.statusCode).toBe(418);
    expect(body.message).toBe('Texto plano');
    expect(body.correlationId).toBe(CORRELATION_ID);
    expect(body.timestamp).toMatch(ISO_REGEX);
    expect(body.path).toBe('/agencias/v1/agencias');
    // Un 4xx NO se loguea como error
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it('HttpException con respuesta objeto: passthrough exacto (statusCode/message intactos)', () => {
    const filtro = new GlobalExceptionFilter();
    const { host, status, json } = crearHostMock();
    const respuestaOriginal = {
      statusCode: 400,
      message: ['email must be an email', 'password is too weak'],
      error: 'Bad Request',
    };

    filtro.catch(new HttpException(respuestaOriginal, 400), host);

    expect(status).toHaveBeenCalledWith(400);
    const body = cuerpoEnviado(json);
    expect(body.statusCode).toBe(400);
    expect(body.message).toEqual([
      'email must be an email',
      'password is too weak',
    ]);
    expect(body.error).toBe('Bad Request');
    expect(body.correlationId).toBe(CORRELATION_ID);
  });
});
