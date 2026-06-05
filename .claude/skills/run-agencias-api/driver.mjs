#!/usr/bin/env node
// Driver harness for agencias-api (NestJS REST API).
//
// What it does:
//   1. Boots an in-memory MongoDB (mongodb-memory-server, cached binary, offline).
//   2. Launches the compiled app (dist/main.js) with a full set of DUMMY env vars
//      so it never touches the real .env / production Mongo / external APIs.
//   3. Waits for the HTTP server, then runs read-only smoke checks (Swagger JSON,
//      auth sign-in -> 401, validation -> 400, public cotizacion lookup -> 4xx).
//   4. Tears everything down and exits non-zero if any check failed.
//
// Modes:
//   node driver.mjs            run smoke checks then exit (CI-style)
//   node driver.mjs serve      boot and KEEP RUNNING for manual curl / Swagger UI
//                              (Ctrl-C to stop). Prints the base URL + Swagger URL.
//
// Requires a prior build: `npm run build` (produces dist/main.js).

import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// .claude/skills/run-agencias-api/driver.mjs  ->  project root is 3 levels up.
const ROOT = process.env.AGENCIAS_ROOT
  ? path.resolve(process.env.AGENCIAS_ROOT)
  : path.resolve(HERE, '../../../');
const ENTRY = path.join(ROOT, 'dist', 'main.js');
const PORT = Number(process.env.AGENCIAS_PORT || 3000);
const BASE = `http://127.0.0.1:${PORT}/agencias/v1`;
const MODE = process.argv[2] === 'serve' ? 'serve' : 'smoke';

// Pin mongodb-memory-server to the version already cached under
// node_modules/.cache/mongodb-memory-server so it never hits the network.
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '8.2.1';
process.env.MONGOMS_DOWNLOAD_DIR =
  process.env.MONGOMS_DOWNLOAD_DIR ||
  path.join(ROOT, 'node_modules', '.cache', 'mongodb-memory-server');

if (!fs.existsSync(ENTRY)) {
  console.error(`[driver] Missing ${ENTRY}\n[driver] Build first:  npm run build`);
  process.exit(2);
}

// Dummy values for every env var the Joi schema in src/config/envs.ts marks
// .required(). Values only need to be non-empty strings (the schema does not
// validate URL/format), so external integrations stay inert.
function dummyEnv(mongoUrl) {
  const s = 'dummy';
  return {
    PORT: String(PORT),
    MONGO_URL: mongoUrl,
    JWT_SECRET: 'dummy-jwt-secret-for-local-smoke',
    COBRE_API_URL: 'http://localhost:0/cobre',
    COBRE_USER_ID: s, COBRE_SECRET: s, COBRE_AUTH_STRING: s, COBRE_API_KEY: s,
    CLOUDINARY_NAME: s, CLOUDINARY_API_KEY: s, CLOUDINARY_API_SECRET: s,
    SENDER_EMAIL: 'noreply@example.com', EMAIL_APP_PASSWORD: s,
    SENDGRID_API_KEY: s,
    GOOGLE_GMAIL_API_KEY: s, GOOGLE_GMAIL_URL: 'http://localhost:0/gmail',
    GOOGLE_GMAIL_CLIENT_ID: s, GOOGLE_GMAIL_CLIENT_SECRET: s,
    GOOGLE_GMAIL_REFRESH_TOKEN: s,
    AUTOCORE_URL: 'http://localhost:0/autocore', AUTOCORE_ACCESS_KEY: s, AUTOCORE_SECRET_KEY: s,
    MY_TOOL_EMAIL: 'mytool@example.com', MY_TOOL_CLAVE: s,
    API_AIXO: s, API_AZUAN: s, API_RODADERO: s, API_AVEXI: s, API_BOCAGRANADE: s,
    API_ABI: s, API_MADISSON: s, API_WINDSOR: s, API_MARINA: s, API_AXIS: s,
    API_MARQUES: s, API_SANSIRAKA: s, API_PLAYASALGUERO: s,
    AMADEUS_API_KEY: s, AMADEUS_API_SECRET: s, AMADEUS_BASE_URL: 'http://localhost:0/amadeus',
    BOOKING_PERSONAS_TOKEN: s,
    MAARLAB_BASE_URL: 'http://localhost:0/maarlab',
    HOST_BRIDGE: 'http://localhost:0/bridge',
    // Keep dev logging (pretty) unless caller overrides.
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
}

function killTree(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
  }
}

async function waitForServer(child, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`app process exited early with code ${child.exitCode}`);
    }
    try {
      const r = await fetch(`${BASE}/api-docs-json`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`server did not become ready within ${timeoutMs}ms`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
    return true;
  } catch (e) {
    console.log(`  FAIL  ${name} — ${e.message}`);
    return false;
  }
}

async function runChecks() {
  const results = [];

  results.push(await check('GET /api-docs-json returns OpenAPI 200', async () => {
    const r = await fetch(`${BASE}/api-docs-json`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    const json = await r.json();
    const paths = Object.keys(json.paths || {}).length;
    if (!paths) throw new Error('no paths in spec');
    return `${paths} routes documented`;
  }));

  results.push(await check('GET /api-docs serves Swagger UI', async () => {
    const r = await fetch(`${BASE}/api-docs`);
    const body = await r.text();
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (!/swagger/i.test(body)) throw new Error('no swagger markup');
    return `${body.length} bytes html`;
  }));

  results.push(await check('POST /auth/sign-in bad creds -> 401', async () => {
    const r = await fetch(`${BASE}/auth/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Password must satisfy SignInDto regex (upper+lower+digit) so it passes
      // ValidationPipe and actually reaches the auth/DB path -> 401 not found.
      body: JSON.stringify({ email: 'nobody@example.com', password: 'Wrongpass1' }),
    });
    if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
    return 'unauthorized as expected (DB query path works)';
  }));

  results.push(await check('POST /auth/sign-in empty body -> 400', async () => {
    const r = await fetch(`${BASE}/auth/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    if (r.status !== 400) throw new Error(`expected 400, got ${r.status}`);
    return 'ValidationPipe rejected empty payload';
  }));

  results.push(await check('GET /cotizaciones/public/:id missing -> 4xx', async () => {
    const r = await fetch(`${BASE}/cotizaciones/public/000000000000000000000000`);
    if (r.status < 400 || r.status >= 500) throw new Error(`expected 4xx, got ${r.status}`);
    return `status ${r.status} for unknown cotizacion`;
  }));

  return results.every(Boolean);
}

async function main() {
  console.log(`[driver] root:  ${ROOT}`);
  console.log(`[driver] entry: ${ENTRY}`);
  console.log(`[driver] mongo: in-memory v${process.env.MONGOMS_VERSION} (offline)`);

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  console.log('[driver] starting in-memory MongoDB...');
  const mongo = await MongoMemoryServer.create();
  const mongoUrl = mongo.getUri();
  console.log(`[driver] mongo ready: ${mongoUrl}`);

  console.log('[driver] launching app...');
  const child = spawn(process.execPath, [ENTRY], {
    cwd: ROOT,
    env: { ...process.env, ...dummyEnv(mongoUrl) },
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: process.platform !== 'win32',
  });

  const shutdown = async (code) => {
    killTree(child);
    try { await mongo.stop(); } catch {}
    process.exit(code);
  };
  process.on('SIGINT', () => shutdown(130));
  process.on('SIGTERM', () => shutdown(143));

  try {
    await waitForServer(child);
  } catch (e) {
    console.error(`[driver] startup failed: ${e.message}`);
    await shutdown(1);
    return;
  }
  console.log(`[driver] server up at ${BASE}`);

  if (MODE === 'serve') {
    console.log('');
    console.log(`  Base URL:   ${BASE}`);
    console.log(`  Swagger UI: ${BASE}/api-docs`);
    console.log(`  OpenAPI:    ${BASE}/api-docs-json`);
    console.log('');
    console.log('[driver] serve mode — Ctrl-C to stop.');
    return; // keep process alive; SIGINT handler tears down
  }

  console.log('\n[driver] running smoke checks:');
  const ok = await runChecks();
  console.log(`\n[driver] ${ok ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
  await shutdown(ok ? 0 : 1);
}

main().catch(async (e) => {
  console.error('[driver] fatal:', e);
  process.exit(1);
});
