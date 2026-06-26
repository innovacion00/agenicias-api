/**
 * Lista agencias sin credencial MaarLab (ni maarlabApiKey ni doc vinculado en
 * maarlab_partner_credentials).
 *
 * Uso:
 *   npm run script:list-agencias-sin-maarlab
 *   npx ts-node -r tsconfig-paths/register scripts/diagnose-maarlab-links.ts
 *   npx ts-node -r tsconfig-paths/register scripts/diagnose-maarlab-links.ts --csv > sin-credenciales.csv
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import mongoose from 'mongoose';
import { normalizeMaarlabName } from '../src/maarlab-credentials/utils/normalize-maarlab-name';

dotenv.config();

type UnlinkedAgencia = {
  _id: string;
  fullName: string;
  slug: string;
  norm: string;
  reason: 'sin_fila_maarlab' | 'credencial_vinculada_a_otra';
  credHotelName?: string;
  credLinkedToOther?: string;
};

function parseArgs(): {
  csv: boolean;
  namesOnly: boolean;
  outFile?: string;
} {
  const args = process.argv.slice(2);
  const csv = args.includes('--csv');
  const namesOnly = args.includes('--names-only');
  const outIdx = args.findIndex((a) => a === '--out');
  const outFile =
    outIdx >= 0 && args[outIdx + 1] ? args[outIdx + 1].trim() : undefined;
  return { csv, namesOnly, outFile };
}

async function main(): Promise<void> {
  const { csv, namesOnly, outFile } = parseArgs();
  const mongoUrl = process.env.MONGO_URL?.trim();
  if (!mongoUrl) {
    console.error('MONGO_URL requerida');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  const agCol = mongoose.connection.collection('agencias');
  const credCol = mongoose.connection.collection('maarlab_partner_credentials');

  const linkedIds = new Set(
    (await credCol.distinct('agenciaId', { agenciaId: { $ne: null } })).map(
      (id) => String(id),
    ),
  );

  const allCreds = await credCol
    .find({})
    .project({ hotelName: 1, normHotelName: 1, agenciaId: 1 })
    .toArray();
  const normToCred = new Map<
    string,
    { hotelName: string; agenciaId?: string }
  >();
  for (const c of allCreds) {
    const norm =
      (c.normHotelName && String(c.normHotelName).trim()) ||
      normalizeMaarlabName(String(c.hotelName ?? ''));
    if (norm) {
      normToCred.set(norm, {
        hotelName: String(c.hotelName),
        agenciaId: c.agenciaId ? String(c.agenciaId) : undefined,
      });
    }
  }

  const unlinked: UnlinkedAgencia[] = [];

  const cursor = agCol
    .find({})
    .project({ fullName: 1, slug: 1, maarlabApiKey: 1 })
    .sort({ _id: 1 });
  for await (const ag of cursor) {
    const id = String(ag._id);
    const hasField =
      ag.maarlabApiKey != null && String(ag.maarlabApiKey).trim().length > 0;
    if (hasField || linkedIds.has(id)) continue;

    const fullName = String(ag.fullName ?? '');
    const slug = String(ag.slug ?? '');
    const norm = normalizeMaarlabName(fullName);
    const cred = norm ? normToCred.get(norm) : undefined;

    unlinked.push({
      _id: id,
      fullName,
      slug,
      norm,
      reason: cred ? 'credencial_vinculada_a_otra' : 'sin_fila_maarlab',
      credHotelName: cred?.hotelName,
      credLinkedToOther:
        cred?.agenciaId && cred.agenciaId !== id ? cred.agenciaId : undefined,
    });
  }

  const lines: string[] = [];

  if (namesOnly) {
    for (const u of unlinked) {
      lines.push(u.fullName);
    }
  } else if (!csv) {
    lines.push(`Agencias sin credencial MaarLab: ${unlinked.length}`);
    lines.push(
      `Credenciales en Mongo: ${allCreds.length} | con agenciaId: ${linkedIds.size}`,
    );
    const sinFila = unlinked.filter((u) => u.reason === 'sin_fila_maarlab');
    const malVinculo = unlinked.filter(
      (u) => u.reason === 'credencial_vinculada_a_otra',
    );
    lines.push(`  - Sin fila en api_keys_by_partner / nombre distinto: ${sinFila.length}`);
    lines.push(`  - Credencial MaarLab ligada a otra agencia: ${malVinculo.length}`);
    lines.push('');
    lines.push('_id\tfullName\tslug\tmotivo');
  } else {
    lines.push('_id,fullName,slug,norm,reason,credHotelName,credLinkedToOther');
  }

  if (!namesOnly) {
    for (const u of unlinked) {
      const motivo =
        u.reason === 'sin_fila_maarlab'
          ? 'sin_fila_maarlab'
          : `cred_en_otra:${u.credLinkedToOther ?? '?'}`;
      if (csv) {
        const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
        lines.push(
          [
            u._id,
            esc(u.fullName),
            esc(u.slug),
            esc(u.norm),
            u.reason,
            esc(u.credHotelName ?? ''),
            u.credLinkedToOther ?? '',
          ].join(','),
        );
      } else {
        lines.push(`${u._id}\t${u.fullName}\t${u.slug || '-'}\t${motivo}`);
      }
    }
  }

  const output = lines.join('\n');

  if (outFile) {
    fs.writeFileSync(outFile, output, 'utf8');
    console.error(`Escrito: ${outFile} (${unlinked.length} filas)`);
  } else {
    console.log(output);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
