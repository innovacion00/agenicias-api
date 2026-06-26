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
 * Solo registra agencias **sin credenciales MaarLab previas**:
 * - `maarlabApiKey` vacío, ausente o null en el documento de `agencias`
 * - sin fila en `maarlab_partner_credentials` con `agenciaId` apuntando a esa agencia y `apiKey` no vacío
 *
 * Después del registro, si la respuesta de MaarLab trae `api_key` + `id_search_engine`,
 * se guarda en `maarlab_partner_credentials` con `agenciaId`. Si no, ejecuta `npm run sync:maarlab-keys`.
 * `external_id` en MaarLab = `_id` del documento en Mongo (hex de ObjectId), único por agencia.
 *
 * Uso: npm run script:register-agencias-maarlab
 */
import * as dotenv from 'dotenv';
import axios, { AxiosError } from 'axios';
import mongoose from 'mongoose';
import { normalizeMaarlabName } from '../src/maarlab-credentials/utils/normalize-maarlab-name';

dotenv.config();

const DEFAULT_ID_CHAIN_SEARCH_ENGINE = 'aff74acf-0379-40e0-a901-393d063ba4d9';
const DEFAULT_ID_PARTNER = '20317285-8045-4336-92f4-efdd24aab67f';
const CLASIFICATION = 3;
const CURRENCY_CODE = 'USD';
const WEBSITE_GEH_SUITES = 'https://gehsuites.com';

const COLLECTION = 'agencias';
const MAARLAB_CREDS_COLLECTION = 'maarlab_partner_credentials';

/** No commitees JWT aquí; usa MAARLAB_REGISTRATION_ACCESS_TOKEN en .env o login. */
const TEMPORARY_REGISTRATION_JWT = '';

function chainSearchEngineId(): string {
  return (
    process.env.MAARLAB_CHAIN_SEARCH_ENGINE_ID?.trim() ||
    DEFAULT_ID_CHAIN_SEARCH_ENGINE
  );
}

function partnerId(): string {
  return process.env.MAARLAB_PARTNER_ID?.trim() || DEFAULT_ID_PARTNER;
}

type ExtractedMaarlabCredential = {
  idSearchEngine: string;
  apiKey: string;
  hotelName: string;
};

/** Busca id_search_engine + api_key en la respuesta de complete_process (estructura anidada). */
function extractMaarlabCredentialFromResponse(
  data: unknown,
): ExtractedMaarlabCredential | null {
  const visited = new Set<object>();

  function walk(obj: unknown): ExtractedMaarlabCredential | null {
    if (obj == null || typeof obj !== 'object' || visited.has(obj as object)) {
      return null;
    }
    visited.add(obj as object);
    const r = obj as Record<string, unknown>;
    const idSearchEngine = [r.id_search_engine, r.idSearchEngine]
      .map((v) => (v == null ? '' : String(v).trim()))
      .find((v) => v.length > 0);
    const apiKey = [r.api_key, r.apiKey]
      .map((v) => (v == null ? '' : String(v).trim()))
      .find((v) => v.length > 0);
    if (idSearchEngine && apiKey) {
      const hotelName = String(
        r.hotel_name ?? r.hotelName ?? r.name ?? idSearchEngine,
      ).trim();
      return { idSearchEngine, apiKey, hotelName };
    }
    for (const v of Object.values(r)) {
      if (v != null && typeof v === 'object') {
        const found = walk(v);
        if (found) return found;
      }
    }
    return null;
  }

  return walk(data);
}

async function persistMaarlabCredential(
  credCol: mongoose.mongo.Collection,
  agenciaId: mongoose.Types.ObjectId,
  hotelNameFallback: string,
  maarlabResponse: unknown,
): Promise<boolean> {
  const extracted = extractMaarlabCredentialFromResponse(maarlabResponse);
  if (!extracted) return false;

  const hotelName = extracted.hotelName || hotelNameFallback;
  const normHotelName =
    normalizeMaarlabName(hotelName) || normalizeMaarlabName(hotelNameFallback);

  await credCol.updateOne(
    { idSearchEngine: extracted.idSearchEngine },
    {
      $set: {
        hotelName,
        normHotelName: normHotelName || hotelName.toLowerCase().trim(),
        apiKey: extracted.apiKey,
        agenciaId: agenciaId,
        lastSyncedAt: new Date(),
      },
    },
    { upsert: true },
  );
  return true;
}

function normalizeBearerToken(raw: string): string {
  return raw.replace(/^Bearer\s+/i, '').trim();
}

/** Nest JWT lleva `_id` de usuario; tokens MaarLab/OceanFlights usan `sub` + `kty`. */
function assertNestAccessToken(token: string): void {
  const t = normalizeBearerToken(token);
  const parts = t.split('.');
  if (parts.length !== 3) {
    throw new Error(
      'El token de registro no parece un JWT válido. Usa accessToken de POST /auth/sign-in.',
    );
  }
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    if (typeof payload._id === 'string' && payload._id.length > 0) return;
    if (
      payload.kty === 'oceanflight_partner' ||
      payload.channel === 'consolidator'
    ) {
      throw new Error(
        'Token MaarLab/OceanFlights detectado (MAARLAB_AUTH_TOKEN o MAARLAB_PARTNER_SYNC_BEARER). ' +
          'Para este script necesitas el JWT Nest de POST /auth/sign-in → MAARLAB_REGISTRATION_ACCESS_TOKEN.',
      );
    }
    throw new Error(
      'JWT sin `_id` de usuario Nest. Obtén uno con POST /auth/sign-in y guárdalo en MAARLAB_REGISTRATION_ACCESS_TOKEN.',
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes('MaarLab')) throw e;
    if (e instanceof Error && e.message.includes('JWT sin')) throw e;
    throw new Error('No se pudo interpretar el JWT de registro.');
  }
}

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
    id_chain_search_engine: chainSearchEngineId(),
    direction: 'Por registrar',
    phone,
    email,
    id_partner: partnerId(),
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

function hasMaarlabApiKeyOnAgencia(ag: { maarlabApiKey?: string | null }): boolean {
  const key = ag.maarlabApiKey;
  return key != null && String(key).trim().length > 0;
}

/** `_id` hex de agencias con credencial en `maarlab_partner_credentials`. */
async function loadAgenciaIdsWithCredentialDocs(): Promise<Set<string>> {
  const credCol = mongoose.connection.collection(MAARLAB_CREDS_COLLECTION);
  const docs = await credCol
    .find({
      agenciaId: { $exists: true, $ne: null },
      apiKey: { $exists: true, $nin: [null, ''] },
    })
    .project({ agenciaId: 1 })
    .toArray();

  const ids = new Set<string>();
  for (const doc of docs) {
    const raw = doc.agenciaId;
    if (raw != null) ids.add(String(raw));
  }
  return ids;
}

function buildPendingCredentialsFilter(
  baseFilter: Record<string, unknown>,
  credAgenciaIds: Set<string>,
): Record<string, unknown> {
  const credObjectIds = [...credAgenciaIds].map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  return {
    ...baseFilter,
    $or: [
      { maarlabApiKey: { $exists: false } },
      { maarlabApiKey: null },
      { maarlabApiKey: '' },
    ],
    ...(credObjectIds.length > 0 ? { _id: { $nin: credObjectIds } } : {}),
  };
}

function agenciaHasCredentials(
  ag: { _id: mongoose.Types.ObjectId; maarlabApiKey?: string | null },
  credAgenciaIds: Set<string>,
): boolean {
  if (hasMaarlabApiKeyOnAgencia(ag)) return true;
  return credAgenciaIds.has(ag._id.toString());
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
  if (direct) {
    const token = normalizeBearerToken(direct);
    assertNestAccessToken(token);
    return token;
  }

  if (TEMPORARY_REGISTRATION_JWT.trim()) {
    console.warn(
      '[register-agencias-maarlab] Usando TEMPORARY_REGISTRATION_JWT (quitar en producción).',
    );
    const token = normalizeBearerToken(TEMPORARY_REGISTRATION_JWT);
    assertNestAccessToken(token);
    return token;
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
  assertNestAccessToken(token);
  return token;
}

function formatAxiosFailure(ax: AxiosError): string {
  const status = ax.response?.status;
  const data = ax.response?.data;
  const nestMsg =
    data &&
    typeof data === 'object' &&
    'error' in data &&
    data.error &&
    typeof data.error === 'object'
      ? [
          (data.error as { message?: string }).message,
          (data.error as { details?: string }).details,
        ]
          .filter(Boolean)
          .join(' | ')
      : '';
  if (status === 401) {
    return (
      nestMsg ||
      '401 Unauthorized — JWT Nest inválido, expirado o de otro entorno (JWT_SECRET distinto). ' +
        'No uses MAARLAB_AUTH_TOKEN ni MAARLAB_PARTNER_SYNC_BEARER; haz sign-in y renueva MAARLAB_REGISTRATION_ACCESS_TOKEN.'
    );
  }
  if (!status) {
    const code = ax.code ? ` (${ax.code})` : '';
    return `Sin respuesta HTTP${code}: ${ax.message}. ¿API levantada en API_BASE_URL?`;
  }
  return nestMsg || JSON.stringify(data ?? ax.message);
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
    `MaarLab chain=${chainSearchEngineId()} partner=${partnerId()} base=${process.env.MAARLAB_BASE_URL ?? '(env MAARLAB_BASE_URL)'}`,
  );
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
  const credCol = mongoose.connection.collection(MAARLAB_CREDS_COLLECTION);

  const filter: Record<string, unknown> = onlyActive ? { isActive: true } : {};
  const credAgenciaIds = await loadAgenciaIdsWithCredentialDocs();
  const pendingFilter = buildPendingCredentialsFilter(filter, credAgenciaIds);
  const cursor = col.find(filter).sort({ _id: 1 });
  const total = await col.countDocuments(filter);
  const pendingTotal = await col.countDocuments(pendingFilter);
  console.log(
    `Agencias en filtro: ${total} | pendientes sin credenciales: ${pendingTotal} (campo maarlabApiKey o doc ${MAARLAB_CREDS_COLLECTION})`,
  );
  if (startIndex > total) {
    console.error(
      `MAARLAB_REGISTER_START_INDEX=${startIndex} es mayor que total=${total}.`,
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;
  let credsSaved = 0;
  let n = 0;
  let skipped = 0;
  let skippedCredentials = 0;

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
      maarlabApiKey?: string | null;
    };

    if (n < startIndex) {
      skipped += 1;
      continue;
    }

    if (agenciaHasCredentials(ag, credAgenciaIds)) {
      skippedCredentials += 1;
      const reason = hasMaarlabApiKeyOnAgencia(ag)
        ? 'maarlabApiKey'
        : 'maarlab_partner_credentials';
      console.log(
        `SKIP (credenciales: ${reason}) ${n}/${total} _id=${ag._id.toString()}`,
      );
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
      const { data } = await axios.post(
        `${apiBase}/vuelos/maarlab/travel-agency/complete-process`,
        body,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 120_000,
        },
      );
      const saved = await persistMaarlabCredential(
        credCol,
        ag._id,
        String(body.name ?? ''),
        data,
      );
      if (saved) credsSaved += 1;
      console.log(
        `OK ${label}${saved ? ' + credencial en Mongo' : ' (sin api_key en respuesta; ejecuta sync:maarlab-keys)'}`,
      );
      ok += 1;
    } catch (err) {
      fail += 1;
      if (axios.isAxiosError(err)) {
        const ax = err as AxiosError;
        const status = ax.response?.status;
        console.error(`FAIL ${label} HTTP ${status}`, formatAxiosFailure(ax));
      } else {
        console.error(`FAIL ${label}`, err);
      }
    }

    if (n < total && delayMs > 0) await sleep(delayMs);
  }

  await mongoose.disconnect();
  console.log(
    `Fin: skippedIndex=${skipped} skippedCredentials=${skippedCredentials} ok=${ok} credsSaved=${credsSaved} fail=${fail} total=${total} pending=${pendingTotal} startIndex=${startIndex}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
