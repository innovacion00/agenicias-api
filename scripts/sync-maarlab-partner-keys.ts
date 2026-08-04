/**
 * Descarga todas las páginas de `api_keys_by_partner` de MaarLab y guarda/actualiza
 * la colección `maarlab_partner_credentials` (upsert por `id_search_engine`).
 * Vincula cada fila a una `Agencia` por:
 *   1. `external_id` de MaarLab = `_id` hex de Mongo (si viene en la fila)
 *   2. nombres normalizados: `normHotelName` ↔ `normalizeMaarlabName(agencia.fullName)` (+ slug)
 *
 * Variables en .env:
 *   MONGO_URL
 *   MAARLAB_BASE_URL (ej. https://test-api.maarlab.online/api/v1)
 *   MAARLAB_PARTNER_SYNC_BEARER  Bearer de partner con permiso para listar keys
 *   MAARLAB_CHAIN_SEARCH_ENGINE_ID  UUID (id_chain_search_engine)
 *
 * Opcional por CLI:
 *   npm run sync:maarlab-keys -- --size=50
 *   npm run sync:maarlab-keys -- --chain=UUID-CADENA
 *
 * No commitees tokens en el repo; rota las claves si se filtraron.
 */
import * as dotenv from 'dotenv';
import axios from 'axios';
import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { AgenciaSchema } from '../src/agencias/entities/agencia.entity';
import { MaarlabPartnerCredentialSchema } from '../src/maarlab-credentials/entities/maarlab-partner-credential.entity';
import { normalizeMaarlabName } from '../src/maarlab-credentials/utils/normalize-maarlab-name';

dotenv.config();

type ApiKeysResponse = {
  items: Array<{
    id_search_engine: string;
    hotel_name: string;
    api_key: string;
    external_id?: string;
  }>;
  total: number;
  page: number;
  size: number;
  pages: number;
};

const CRED_MODEL = 'SyncMaarlabCredential';
const AGENCIA_MODEL = 'SyncAgenciaForMaarlab';
/** Colecciones reales en Mongo (el nombre del modelo del script NO debe inferirse solo). */
const AGENCIAS_COLLECTION = 'agencias';
const MAARLAB_CREDS_COLLECTION = 'maarlab_partner_credentials';

const MAX_UNLINKED_SAMPLES = 15;

function baseUrl(): string {
  const raw = process.env.MAARLAB_BASE_URL?.trim();
  if (!raw) throw new Error('MAARLAB_BASE_URL no definida');
  let b = raw;
  if (!b.startsWith('http://') && !b.startsWith('https://')) b = `https://${b}`;
  return b.replace(/\/$/, '');
}

/** Claves normalizadas con las que una agencia puede emparejarse. */
function agencyMatchKeys(fullName: string, slug?: string): string[] {
  const keys = new Set<string>();
  const fromName = normalizeMaarlabName(fullName);
  if (fromName) keys.add(fromName);
  if (slug?.trim()) {
    const fromSlug = normalizeMaarlabName(slug.replace(/-/g, ' '));
    if (fromSlug) keys.add(fromSlug);
  }
  return [...keys];
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL?.trim();
  if (!mongoUrl) {
    console.error('MONGO_URL requerida');
    process.exit(1);
  }

  const bearer = process.env.MAARLAB_PARTNER_SYNC_BEARER?.trim();
  if (!bearer) {
    console.error(
      'MAARLAB_PARTNER_SYNC_BEARER requerida (Bearer de partner para listar API keys)',
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const sizeArg = args.find((a) => a.startsWith('--size='));
  const chainArg = args.find((a) => a.startsWith('--chain='));
  const pageSize = sizeArg
    ? Math.min(100, Math.max(1, parseInt(sizeArg.split('=')[1]!, 10) || 15))
    : 15;

  const chainId =
    chainArg?.split('=')[1]?.trim() ||
    process.env.MAARLAB_CHAIN_SEARCH_ENGINE_ID?.trim();
  if (!chainId) {
    console.error(
      'Define MAARLAB_CHAIN_SEARCH_ENGINE_ID o pasa --chain=<uuid>',
    );
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);

  const Credential =
    mongoose.models[CRED_MODEL] ??
    mongoose.model(
      CRED_MODEL,
      MaarlabPartnerCredentialSchema,
      MAARLAB_CREDS_COLLECTION,
    );
  const AgenciaModel =
    mongoose.models[AGENCIA_MODEL] ??
    mongoose.model(AGENCIA_MODEL, AgenciaSchema, AGENCIAS_COLLECTION);

  const agenciaCount = await AgenciaModel.countDocuments().exec();
  console.log(
    `MongoDB: db="${mongoose.connection.name}" | ${AGENCIAS_COLLECTION}: ${agenciaCount} documentos`,
  );
  if (agenciaCount === 0) {
    console.warn(
      `[maarlab-sync] No hay agencias en "${AGENCIAS_COLLECTION}". Revisa MONGO_URL (antes el script leía otra colección vacía por el nombre del modelo).`,
    );
  }

  const root = baseUrl();
  const path = 'search_engine/api_keys_by_partner/';
  let page = 1;
  let pages = 1;
  let totalUpserts = 0;

  do {
    const url = `${root}/${path}`;
    const { data } = await axios.get<ApiKeysResponse>(url, {
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: 'application/json',
      },
      params: {
        id_chain_search_engine: chainId,
        page,
        size: pageSize,
      },
    });

    pages = Math.max(1, data.pages || 1);
    const items = data.items || [];
    const now = new Date();

    if (page === 1 && items.length === 0) {
      console.warn(
        `[maarlab-sync] MaarLab devolvió 0 items (total=${data.total ?? 'n/a'}, pages=${data.pages ?? 'n/a'}). ` +
          `Revisa MAARLAB_BASE_URL, MAARLAB_CHAIN_SEARCH_ENGINE_ID y que el Bearer sea de partner con keys en esa cadena.`,
      );
      console.warn(
        `[maarlab-sync] GET ${url} | id_chain_search_engine=${chainId}`,
      );
    }

    for (const row of items) {
      const idSe = row.id_search_engine?.trim();
      if (!idSe) continue;
      const hotelNameRaw = row.hotel_name ?? '';
      const hotelName = hotelNameRaw.trim() || idSe;
      const normHotelName = normalizeMaarlabName(hotelName);
      const apiKey = (row.api_key ?? '').trim();
      if (!apiKey) continue;

      const externalIdRaw = String(row.external_id ?? '').trim().toLowerCase();
      const agenciaIdFromExternal =
        externalIdRaw && Types.ObjectId.isValid(externalIdRaw)
          ? new Types.ObjectId(externalIdRaw)
          : null;

      await Credential.updateOne(
        { idSearchEngine: idSe },
        {
          $set: {
            hotelName,
            normHotelName: normHotelName || hotelName.toLowerCase().trim(),
            apiKey,
            lastSyncedAt: now,
            ...(agenciaIdFromExternal ? { agenciaId: agenciaIdFromExternal } : {}),
          },
        },
        { upsert: true },
      );
      totalUpserts++;
    }

    console.log(
      `Página ${page}/${pages} — filas: ${items.length}, upserts acumulados: ${totalUpserts}`,
    );
    page++;
  } while (page <= pages);

  const agencias = await AgenciaModel.find({})
    .select('_id fullName slug')
    .sort({ _id: 1 })
    .lean()
    .exec();

  /** normKey → agenciaId (si hay colisión, gana la agencia más reciente por _id) */
  const normKeyToAgencia = new Map<string, Types.ObjectId>();
  let agenciesWithKeys = 0;
  let collisionReplacements = 0;

  /** external_id hex → agenciaId */
  const externalIdToAgencia = new Map<string, Types.ObjectId>();

  for (const a of agencias) {
    const fn = a.fullName;
    if (fn == null || fn === '') continue;

    externalIdToAgencia.set(String(a._id), a._id as Types.ObjectId);

    const keys = agencyMatchKeys(fn, a.slug as string | undefined);
    if (keys.length === 0) continue;
    agenciesWithKeys++;

    const agenciaId = a._id as Types.ObjectId;
    for (const key of keys) {
      const prev = normKeyToAgencia.get(key);
      if (prev && prev.toString() !== agenciaId.toString()) {
        collisionReplacements++;
        console.warn(
          `[maarlab-sync] Colisión "${key}": ${prev} → ${agenciaId} (se mantiene la más reciente)`,
        );
      }
      normKeyToAgencia.set(key, agenciaId);
    }
  }

  if (collisionReplacements > 0) {
    console.log(
      `[maarlab-sync] Colisiones resueltas a favor de agencia más reciente: ${collisionReplacements}`,
    );
  }

  let linked = 0;
  let linkedByExternal = 0;
  let unlinked = 0;
  const unlinkedSamples: string[] = [];

  const allCreds = await Credential.find({}).lean().exec();
  for (const c of allCreds) {
    let aid: Types.ObjectId | undefined;
    const norm =
      (c.normHotelName && String(c.normHotelName).trim()) ||
      normalizeMaarlabName(c.hotelName as string);

    const credAgenciaId = c.agenciaId as Types.ObjectId | null | undefined;
    if (credAgenciaId) {
      aid = credAgenciaId;
      linkedByExternal += 1;
    }

    if (!aid) {
      aid = norm ? normKeyToAgencia.get(norm) : undefined;
    }

    if (aid) {
      if (!credAgenciaId) {
        await Credential.updateOne(
          { _id: c._id },
          { $set: { agenciaId: aid } },
        );
      }
      linked++;
    } else {
      await Credential.updateOne(
        { _id: c._id },
        { $unset: { agenciaId: '' } },
      );
      unlinked++;
      if (unlinkedSamples.length < MAX_UNLINKED_SAMPLES) {
        unlinkedSamples.push(
          `hotelName="${c.hotelName}" normHotelName="${norm || '(vacío)'}"`,
        );
      }
    }
  }

  console.log(
    `Listo. Upserts: ${totalUpserts} | agencias indexadas: ${agenciesWithKeys}/${agencias.length} | vínculos: ${linked}/${allCreds.length} (por external_id en fila: ${linkedByExternal}) | sin match: ${unlinked}`,
  );
  console.log(
    `Comparación: external_id MaarLab ↔ Agencia._id | normHotelName ↔ normalizeMaarlabName(fullName)`,
  );
  if (unlinkedSamples.length > 0) {
    console.log('Ejemplos sin vínculo (revisar nombres en MaarLab vs fullName en Mongo):');
    for (const line of unlinkedSamples) {
      console.log(`  - ${line}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
