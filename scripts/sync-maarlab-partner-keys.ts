/**
 * Descarga todas las páginas de `api_keys_by_partner` de MaarLab y guarda/actualiza
 * la colección `maarlab_partner_credentials` (upsert por `id_search_engine`).
 * Intenta vincular cada fila a una `Agencia` por nombre normalizado (`hotel_name` vs `fullName`).
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
import { normalizeMaarlabAgencyName } from '../src/maarlab-credentials/normalize-maarlab-agency-name';

dotenv.config();

type ApiKeysResponse = {
  items: Array<{
    id_search_engine: string;
    hotel_name: string;
    api_key: string;
  }>;
  total: number;
  page: number;
  size: number;
  pages: number;
};

const CRED_MODEL = 'SyncMaarlabCredential';
const AGENCIA_MODEL = 'SyncAgenciaForMaarlab';

function baseUrl(): string {
  const raw = process.env.MAARLAB_BASE_URL?.trim();
  if (!raw) throw new Error('MAARLAB_BASE_URL no definida');
  let b = raw;
  if (!b.startsWith('http://') && !b.startsWith('https://')) b = `https://${b}`;
  return b.replace(/\/$/, '');
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
    mongoose.model(CRED_MODEL, MaarlabPartnerCredentialSchema);
  const AgenciaModel =
    mongoose.models[AGENCIA_MODEL] ?? mongoose.model(AGENCIA_MODEL, AgenciaSchema);

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

    pages = data.pages || 1;
    const items = data.items || [];
    const now = new Date();

    for (const row of items) {
      const idSe = row.id_search_engine?.trim();
      if (!idSe) continue;
      const hotelName = (row.hotel_name ?? '').trim();
      const apiKey = (row.api_key ?? '').trim();
      if (!apiKey) continue;

      await Credential.updateOne(
        { idSearchEngine: idSe },
        {
          $set: {
            hotelName: hotelName || idSe,
            normHotelName: normalizeMaarlabAgencyName(hotelName || idSe),
            apiKey,
            lastSyncedAt: now,
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
    .select('_id fullName')
    .lean()
    .exec();

  const normToAgencia = new Map<string, Types.ObjectId>();
  for (const a of agencias) {
    const n = normalizeMaarlabAgencyName(a.fullName);
    if (!n) continue;
    if (!normToAgencia.has(n)) {
      normToAgencia.set(n, a._id as Types.ObjectId);
    } else {
      console.warn(
        `[maarlab-sync] Varias agencias con nombre normalizado "${n}": se mantiene la primera`,
      );
    }
  }

  let linked = 0;
  const allCreds = await Credential.find({}).lean().exec();
  for (const c of allCreds) {
    const aid = normToAgencia.get(c.normHotelName);
    if (aid) {
      await Credential.updateOne(
        { _id: c._id },
        { $set: { agenciaId: aid } },
      );
      linked++;
    } else {
      await Credential.updateOne(
        { _id: c._id },
        { $unset: { agenciaId: '' } },
      );
    }
  }

  console.log(
    `Listo. Upserts en esta corrida: ${totalUpserts}, vínculos agenciaId por nombre: ${linked}`,
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
