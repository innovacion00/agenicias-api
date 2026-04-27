import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AeropuertoReferencia } from './entities/aeropuerto-referencia.entity';
import { AeropuertoSugerenciaDto } from './dto/aeropuerto-sugerencia.dto';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toDto(doc: AeropuertoReferencia | Record<string, unknown>): AeropuertoSugerenciaDto {
  const d = doc as AeropuertoReferencia;
  return {
    icao: d.icao,
    iata: d.iata ?? null,
    name: d.name,
    city: d.city,
    state: d.state ?? '',
    country: d.country,
    lat: d.lat ?? null,
    lon: d.lon ?? null,
    tz: d.tz ?? '',
  };
}

@Injectable()
export class ReferenciaAeropuertosService {
  private readonly memCache = new Map<
    string,
    { t: number; rows: AeropuertoSugerenciaDto[] }
  >();
  private readonly memTtlMs = 45_000;
  private readonly memMaxEntries = 150;

  constructor(
    @InjectModel(AeropuertoReferencia.name)
    private readonly model: Model<AeropuertoReferencia>,
  ) {}

  private memGet(key: string): AeropuertoSugerenciaDto[] | null {
    const e = this.memCache.get(key);
    if (!e) return null;
    if (Date.now() - e.t > this.memTtlMs) {
      this.memCache.delete(key);
      return null;
    }
    return e.rows;
  }

  private memSet(key: string, rows: AeropuertoSugerenciaDto[]): void {
    if (this.memCache.size >= this.memMaxEntries) {
      const first = this.memCache.keys().next().value;
      if (first !== undefined) this.memCache.delete(first);
    }
    this.memCache.set(key, { t: Date.now(), rows });
  }

  async suggestPredictivo(
    q: string,
    limit = 20,
    country?: string,
  ): Promise<AeropuertoSugerenciaDto[]> {
    const trimmed = q.trim();
    if (!trimmed) return [];

    const cc = country?.trim().toUpperCase();
    const lim = Math.min(Math.max(limit, 1), 50);
    const cacheKey = `${trimmed.toLowerCase()}|${cc ?? ''}|${lim}`;
    const cached = this.memGet(cacheKey);
    if (cached) return cached;

    let raw: AeropuertoReferencia[] = [];

    if (trimmed.includes(' ')) {
      raw = await this.buscarPorTexto(trimmed, cc, lim);
    }

    if (!raw.length) {
      raw = await this.buscarPorPrefijo(trimmed, cc, lim);
    }

    const rows = raw.map(toDto);
    this.memSet(cacheKey, rows);
    return rows;
  }

  private async buscarPorTexto(
    trimmed: string,
    country: string | undefined,
    limit: number,
  ): Promise<AeropuertoReferencia[]> {
    try {
      const base =
        country !== undefined
          ? { $text: { $search: trimmed }, country }
          : { $text: { $search: trimmed } };

      return this.model
        .find(base)
        .select({ score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .lean()
        .exec() as Promise<AeropuertoReferencia[]>;
    } catch {
      return [];
    }
  }

  private async buscarPorPrefijo(
    trimmed: string,
    country: string | undefined,
    limit: number,
  ): Promise<AeropuertoReferencia[]> {
    const lower = trimmed.toLowerCase();
    const escaped = escapeRegex(lower);
    const prefName = new RegExp(`^${escaped}`);
    const prefCity = new RegExp(`^${escaped}`);
    const up = trimmed.toUpperCase();
    const escapedUp = escapeRegex(up);
    const prefIcao = new RegExp(`^${escapedUp}`);

    const codeConds: Record<string, unknown>[] = [];
    if (/^[A-Za-z]{2,3}$/.test(trimmed)) {
      codeConds.push({ iata: up });
      codeConds.push({ iata: new RegExp(`^${escapedUp}`) });
    }

    const or: Record<string, unknown>[] = [
      ...codeConds,
      { normName: prefName },
      { normCity: prefCity },
      { icao: prefIcao },
    ];

    const filter: Record<string, unknown> =
      country !== undefined
        ? { country, $or: or }
        : { $or: or };

    return this.model
      .find(filter)
      .limit(limit)
      .lean()
      .exec() as Promise<AeropuertoReferencia[]>;
  }

  async contar(): Promise<number> {
    return this.model.estimatedDocumentCount();
  }
}
