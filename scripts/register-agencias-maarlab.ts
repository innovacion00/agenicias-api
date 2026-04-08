/**
 * Registra cada agencia de Mongo en MaarLab vía POST /vuelos/maarlab/travel-agency/complete-process.
 *
 * Requisitos:
 * - Usuario con JWT cuya agencia tenga `maarlabApiKey` válido (token consolidator que permita crear agencias).
 *
 * Variables de entorno:
 * - MONGO_URL (obligatoria)
 * - API_BASE_URL — base con prefijo, ej. http://localhost:3000/agencias/v1 (default)
 * - MAARLAB_REGISTRATION_ACCESS_TOKEN o AGENCIAS_SCRIPT_JWT — JWT Nest (prioridad sobre el temporal en código)
 * - Si no hay env: el script usa TEMPORARY_REGISTRATION_JWT (pruebas; dejar en '' y usar env o sign-in en prod)
 * - MAARLAB_REGISTRATION_EMAIL + contraseña — solo si no hay env y el temporal está vacío
 * - MAARLAB_REGISTER_DELAY_MS — pausa entre solicitudes (default 2000)
 * - MAARLAB_REGISTER_ONLY_ACTIVE=true — solo agencias con isActive
 * - MAARLAB_REGISTER_DRY_RUN=true — no llama al API, solo imprime
 * - MAARLAB_REGISTER_START_INDEX — índice 1-based donde continuar (ej. 657 tras FAIL 657/941; se omiten 1..656)
 * - MAARLAB_REGISTER_RESUME_VERIFY_ID — opcional; hex del `_id` que debe tener ese índice (mismo sort `_id: 1` y filtro)
 *
 * Constantes: moneda USD, website https://gehsuites.com para todas. No se envía `prefix_locator` (opcional en MaarLab).
 * `external_id` en MaarLab = `_id` del documento en Mongo (hex de ObjectId), único por agencia.
 *
 * Uso: npm run script:register-agencias-maarlab
 */
import * as dotenv from 'dotenv';
import axios, { AxiosError } from 'axios';
import mongoose from 'mongoose';

dotenv.config();

const ID_CHAIN_SEARCH_ENGINE = 'aff74acf-0379-40e0-a901-393d063ba4d9';
const ID_PARTNER = '20317285-8045-4336-92f4-efdd24aab67f';
const CLASIFICATION = 3;
const CURRENCY_CODE = 'USD';
const WEBSITE_GEH_SUITES = 'https://gehsuites.com';

const COLLECTION = 'agencias';

/**
 * TEMPORAL — solo pruebas locales; caduca pronto. Quitar antes de producción.
 * Si defines MAARLAB_REGISTRATION_ACCESS_TOKEN (o AGENCIAS_SCRIPT_JWT), ese valor manda.
 */
const TEMPORARY_REGISTRATION_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2OGI4NGEyNzJiZTQzNDhlNjYxZjEzYWEiLCJpYXQiOjE3NzQ5NjAyNzksImV4cCI6MTc3NDk2Mzg3OX0.2PVxZDpUK9aRD06SMM3Z3Ujsu0LODHcSBOpAcjPPx5k';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Nest @IsNotEmpty no acepta ''; usamos marcadores mínimos. */
function nz(v: unknown, fallback = '-'): string {
  if (v == null) return fallback;
  const s = String(v).trim();
  return s.length > 0 ? s : fallback;
}

/** Formato E.164 mínimo creíble; MaarLab a menudo valida longitud/prefijo. */
function normalizePhoneForMaarLab(raw: unknown): string {
  const s = raw == null ? '' : String(raw).trim();
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return '+573001000000';
}

function buildPayload(ag: {
  _id: mongoose.Types.ObjectId;
  fullName?: string;
  slug?: string;
  emailContacto?: string;
  telefonoContacto?: string;
  documentInfo?: { tipo?: string; document?: string };
  politicasAgencia?: string;
}): Record<string, unknown> {
  const id = ag._id.toString();
  /** Identificador estable y único en MaarLab; coincide con `_id` en Mongo. */
  const external_id = id;
  const name = nz(ag.fullName, `Agencia ${id}`);
  const email = nz(ag.emailContacto, 'noreply@example.com');
  /** MaarLab suele rechazar teléfonos ficticios o solo guiones. */
  const phone = normalizePhoneForMaarLab(ag.telefonoContacto);
  const doc = ag.documentInfo?.document
    ? String(ag.documentInfo.document).replace(/\s/g, '')
    : '';

  return {
    name,
    external_id,
    description: nz(ag.politicasAgencia, '').slice(0, 500) || undefined,
    id_chain_search_engine: ID_CHAIN_SEARCH_ENGINE,
    direction: 'Por registrar',
    phone,
    email,
    id_partner: ID_PARTNER,
    clasification: CLASIFICATION,
    currency_code: CURRENCY_CODE,
    post_code: '110111',
    city: 'Bogotá',
    country: 'Colombia',
    website: WEBSITE_GEH_SUITES,
    hours_of_operation: 'Lun-Vie 9:00-18:00',
    /** CIF demasiado corto o "-" suele fallar validación en APIs fiscales. */
    cif: nz(doc, '000000000'),
    registered_company_name: name,
    contact_center_type: 'PROPIO',
    account_manager_name: name.slice(0, 100),
    account_manager_email: email,
    account_manager_phone: phone,
  };
}

function firstEnv(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

function authHelp(): string {
  return `
No hay JWT ni credenciales de login para llamar a la API Nest.

Añade en tu .env (raíz del proyecto) UNA de estas opciones:

  Opción A — Token JWT emitido por esta API (usuario de una agencia que tenga maarlabApiKey):
    MAARLAB_REGISTRATION_ACCESS_TOKEN=eyJhbGciOi...

  (alias: AGENCIAS_SCRIPT_JWT)

  Opción B — Usuario con sesión sin OTP (omitirOtp) o tras validar OTP:
    MAARLAB_REGISTRATION_EMAIL=tu@correo.com
    MAARLAB_REGISTRATION_PASSWORD=tu_clave

  (alias: AGENCIAS_SCRIPT_EMAIL / AGENCIAS_SCRIPT_PASSWORD)

Nota: MAARLAB_AUTH_TOKEN del .env es el token de OceanFlights/MaarLab directo;
no sirve como Authorization en /agencias/v1/... (ahí va el JWT Nest).
`.trim();
}

async function getAccessToken(apiBase: string): Promise<string> {
  const direct = firstEnv(
    'MAARLAB_REGISTRATION_ACCESS_TOKEN',
    'AGENCIAS_SCRIPT_JWT',
  );
  if (direct) return direct;

  if (TEMPORARY_REGISTRATION_JWT.trim()) {
    console.warn(
      '[register-agencias-maarlab] Usando TEMPORARY_REGISTRATION_JWT (quitar en producción).',
    );
    return TEMPORARY_REGISTRATION_JWT.trim();
  }

  const email = firstEnv('MAARLAB_REGISTRATION_EMAIL', 'AGENCIAS_SCRIPT_EMAIL');
  const password = firstEnv(
    'MAARLAB_REGISTRATION_PASSWORD',
    'AGENCIAS_SCRIPT_PASSWORD',
  );

  if (!email || password == null || String(password).length === 0) {
    throw new Error(authHelp());
  }

  const { data } = await axios.post(`${apiBase}/auth/sign-in`, {
    email,
    password: String(password),
  });
  const token = data?.accessToken as string | undefined;
  if (!token) {
    throw new Error(
      `${authHelp()}\n\n(sign-in respondió sin accessToken: revisa OTP u omitirOtp.)`,
    );
  }
  return token;
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL?.trim();
  if (!mongoUrl) {
    console.error('MONGO_URL es obligatoria.');
    process.exit(1);
  }

  const apiBase = (process.env.API_BASE_URL ?? 'http://localhost:3000/agencias/v1').replace(
    /\/$/,
    '',
  );
  const delayMs = Math.max(0, parseInt(process.env.MAARLAB_REGISTER_DELAY_MS ?? '2000', 10) || 2000);
  const onlyActive = process.env.MAARLAB_REGISTER_ONLY_ACTIVE === 'true';
  const dryRun = process.env.MAARLAB_REGISTER_DRY_RUN === 'true';
  const startIndex = Math.max(
    1,
    parseInt(process.env.MAARLAB_REGISTER_START_INDEX ?? '1', 10) || 1,
  );
  const resumeVerifyIdRaw = firstEnv(
    'MAARLAB_REGISTER_RESUME_VERIFY_ID',
    'MAARLAB_REGISTER_VERIFY_OBJECT_ID',
  );
  const resumeVerifyId = resumeVerifyIdRaw?.toLowerCase().replace(/\s/g, '');

  console.log(`API: ${apiBase}`);
  console.log(
    `Delay: ${delayMs}ms | onlyActive=${onlyActive} dryRun=${dryRun} startIndex=${startIndex}${resumeVerifyIdRaw ? ` verifyId=${resumeVerifyIdRaw.trim()}` : ''}`,
  );
  if (startIndex > 1) {
    console.log(
      `[resume] Continuando desde índice ${startIndex} (mismo filtro onlyActive=${onlyActive}, sort _id asc).`,
    );
    if (resumeVerifyId) {
      console.log(
        `[resume] Se comprobará que el documento en ese índice tenga _id=${resumeVerifyId}`,
      );
    }
  }

  const accessToken = dryRun ? '' : await getAccessToken(apiBase);
  if (!dryRun) console.log('JWT obtenido OK');

  await mongoose.connect(mongoUrl);
  const col = mongoose.connection.collection(COLLECTION);

  const filter: Record<string, unknown> = onlyActive ? { isActive: true } : {};
  const cursor = col.find(filter).sort({ _id: 1 });
  const total = await col.countDocuments(filter);
  console.log(`Agencias a procesar: ${total}`);
  if (startIndex > total) {
    console.error(
      `MAARLAB_REGISTER_START_INDEX=${startIndex} es mayor que total=${total}.`,
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;
  let n = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    n += 1;
    const ag = doc as {
      _id: mongoose.Types.ObjectId;
      fullName?: string;
      slug?: string;
      emailContacto?: string;
      telefonoContacto?: string;
      documentInfo?: { tipo?: string; document?: string };
      politicasAgencia?: string;
    };

    if (n < startIndex) {
      skipped += 1;
      continue;
    }

    if (n === startIndex && resumeVerifyId) {
      const actual = ag._id.toString().toLowerCase();
      if (actual !== resumeVerifyId) {
        await mongoose.disconnect();
        throw new Error(
          `[resume] Índice ${startIndex}: _id del documento es ${ag._id.toString()} pero MAARLAB_REGISTER_RESUME_VERIFY_ID es ${resumeVerifyId}. ` +
            'Revisa que MONGO_URL, MAARLAB_REGISTER_ONLY_ACTIVE y el orden (_id asc) sean los mismos que en la corrida anterior.',
        );
      }
      console.log(
        `[resume] Verificación OK: posición ${startIndex}/${total} → _id=${actual}`,
      );
    }

    const body = buildPayload(ag);
    const label = `${n}/${total} _id=${ag._id.toString()} external_id=${body.external_id}`;

    if (dryRun) {
      console.log(`[DRY] ${label}`, JSON.stringify(body));
      continue;
    }

    try {
      await axios.post(`${apiBase}/vuelos/maarlab/travel-agency/complete-process`, body, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 120_000,
      });
      console.log(`OK ${label}`);
      ok += 1;
    } catch (err) {
      fail += 1;
      if (axios.isAxiosError(err)) {
        const ax = err as AxiosError<{
          message?: string | string[];
          error?: { message?: string; details?: string };
        }>;
        const status = ax.response?.status;
        const data = ax.response?.data;
        const nestMsg =
          data &&
          typeof data === 'object' &&
          'error' in data &&
          data.error &&
          typeof data.error === 'object'
            ? [data.error.message, data.error.details].filter(Boolean).join(' | ')
            : '';
        const msg = nestMsg || JSON.stringify(data ?? ax.message);
        console.error(`FAIL ${label} HTTP ${status}`, msg);
      } else {
        console.error(`FAIL ${label}`, err);
      }
    }

    if (n < total && delayMs > 0) await sleep(delayMs);
  }

  await mongoose.disconnect();
  console.log(
    `Fin: skipped=${skipped} ok=${ok} fail=${fail} total=${total} startIndex=${startIndex}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
