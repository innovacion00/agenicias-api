import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ErrorManager } from 'src/common/helpers';
import {
  CreatePrecioExtraDto,
  PrecioExtraQueryDto,
  UpdatePrecioExtraDto,
} from './dto';
import { PrecioExtra } from './entities/precio-extra.entity';

export interface PrecioExtraPublico {
  _id: string;
  concepto: string;
  detalle: string;
  hotelId: number | null;
  ciudad: string | null;
  unidad: string;
  paxPorVehiculo: number | null;
  porcentaje: number | null;
  precioCOP: number | null;
  precioUSD: number | null;
  precio: number | null;
  orden: number;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  /** Metadata libre (ej. tours: description, images, includes, toBring, etc.). */
  informacion?: Record<string, unknown> | null;
}

type MemVal = { t: number; rows: PrecioExtraPublico[] };

@Injectable()
export class PreciosExtrasService {
  private readonly logger = new Logger(PreciosExtrasService.name);
  private readonly errorManager = new ErrorManager(PreciosExtrasService.name);
  private readonly memCache = new Map<string, MemVal>();
  private readonly memTtlMs = 60_000;
  private readonly memMaxEntries = 120;

  constructor(
    @InjectModel(PrecioExtra.name)
    private readonly model: Model<PrecioExtra>,
  ) {}

  private memGet(key: string): PrecioExtraPublico[] | null {
    const e = this.memCache.get(key);
    if (!e) return null;
    if (Date.now() - e.t > this.memTtlMs) {
      this.memCache.delete(key);
      return null;
    }
    return e.rows;
  }

  private memSet(key: string, rows: PrecioExtraPublico[]): void {
    if (this.memCache.size >= this.memMaxEntries) {
      const first = this.memCache.keys().next().value;
      if (first !== undefined) this.memCache.delete(first);
    }
    this.memCache.set(key, { t: Date.now(), rows });
  }

  private validarValores(dto: CreatePrecioExtraDto | UpdatePrecioExtraDto): void {
    const { precioCOP, precioUSD, porcentaje } = dto;
    const hayPrecio =
      (precioCOP != null && Number(precioCOP) >= 0) ||
      (precioUSD != null && Number(precioUSD) >= 0);
    const hayPorcentaje = porcentaje != null && Number(porcentaje) >= 0;
    if (!hayPrecio && !hayPorcentaje) {
      throw new BadRequestException(
        'Indique al menos un precio (COP y/o USD) o un porcentaje',
      );
    }
  }

  private normalizar(
    dto: CreatePrecioExtraDto,
  ): Record<string, unknown> {
    const ciudad =
      typeof dto.ciudad === 'string' && dto.ciudad.trim() !== ''
        ? dto.ciudad.trim().toUpperCase()
        : null;
    const hotelId =
      dto.hotelId == null || Number.isNaN(Number(dto.hotelId))
        ? null
        : Number(dto.hotelId);
    return {
      concepto: dto.concepto,
      detalle: dto.detalle.trim(),
      hotelId,
      ciudad,
      precioCOP: dto.precioCOP ?? null,
      precioUSD: dto.precioUSD ?? null,
      unidad: dto.unidad,
      paxPorVehiculo: dto.paxPorVehiculo ?? null,
      porcentaje: dto.porcentaje ?? null,
      vigenciaDesde: dto.vigenciaDesde ? new Date(dto.vigenciaDesde) : null,
      vigenciaHasta: dto.vigenciaHasta ? new Date(dto.vigenciaHasta) : null,
      activo: dto.activo ?? true,
      orden: dto.orden ?? 0,
    };
  }

  /** Como `normalizar` pero solo incluye las propiedades enviadas (PATCH). */
  private normalizarParcial(
    dto: UpdatePrecioExtraDto,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(dto) as (keyof UpdatePrecioExtraDto)[]) {
      const val = dto[key];
      if (val === undefined) continue;
      switch (key) {
        case 'detalle':
          out.detalle = String(val).trim();
          break;
        case 'hotelId':
          out.hotelId =
            val == null || Number.isNaN(Number(val)) ? null : Number(val);
          break;
        case 'ciudad':
          out.ciudad =
            typeof val === 'string' && val.trim() !== ''
              ? val.trim().toUpperCase()
              : null;
          break;
        case 'precioCOP':
        case 'precioUSD':
          out[key] = val ?? null;
          break;
        case 'paxPorVehiculo':
        case 'porcentaje':
        case 'orden':
          out[key] = val ?? null;
          break;
        case 'vigenciaDesde':
        case 'vigenciaHasta':
          out[key] = val ? new Date(val as Date) : null;
          break;
        case 'informacion':
          out.informacion = val;
          break;
        default:
          out[key] = val;
      }
    }
    return out;
  }

  async crear(dto: CreatePrecioExtraDto) {
    try {
      this.validarValores(dto);
      const doc = await this.model.create(this.normalizar(dto));
      this.memCache.clear();
      return doc.toJSON();
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async actualizar(id: string, dto: UpdatePrecioExtraDto) {
    try {
      this.validarValores(dto);
      const base = await this.model.findById(id);
      if (!base) throw new NotFoundException('Precio extra no encontrado');

      Object.assign(base, this.normalizarParcial(dto));
      const doc = await base.save();
      this.memCache.clear();
      return doc.toJSON();
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async eliminar(id: string) {
    try {
      const doc = await this.model.findByIdAndDelete(id);
      if (!doc) throw new NotFoundException('Precio extra no encontrado');
      this.memCache.clear();
      return { msg: 'Precio extra eliminado', id };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async listarAdmin() {
    return this.model
      .find()
      .sort({ concepto: 1, orden: 1, _id: 1 })
      .lean()
      .exec();
  }

  private enVigencia(item: PrecioExtra): boolean {
    const now = Date.now();
    if (item.vigenciaDesde && now < new Date(item.vigenciaDesde).getTime()) {
      return false;
    }
    if (item.vigenciaHasta && now > new Date(item.vigenciaHasta).getTime()) {
      return false;
    }
    return true;
  }

  private aplicarScope(
    item: PrecioExtra,
    q: PrecioExtraQueryDto,
  ): boolean {
    const hotelFiltrado = q.hotelId != null && !Number.isNaN(Number(q.hotelId));

    if (hotelFiltrado) {
      const hotelId = Number(q.hotelId);
      if (item.hotelId != null && item.hotelId !== hotelId) return false;
    } else if (item.hotelId != null) {
      // Sin contexto de hotel, solo se sirven los precios globales.
      return false;
    }

    if (typeof q.ciudad === 'string' && q.ciudad.trim() !== '') {
      const c = q.ciudad.trim().toUpperCase();
      if (item.ciudad && item.ciudad !== c) return false;
    }

    if (q.concepto && item.concepto !== q.concepto) return false;

    return true;
  }

  private toPublico(item: PrecioExtra, currency?: string): PrecioExtraPublico {
    const usaUsd = (currency ?? 'COP').toUpperCase() === 'USD';
    return {
      _id: String((item as unknown as { _id: string })._id),
      concepto: item.concepto,
      detalle: item.detalle,
      hotelId: item.hotelId ?? null,
      ciudad: item.ciudad ?? null,
      unidad: item.unidad,
      paxPorVehiculo: item.paxPorVehiculo ?? null,
      porcentaje: item.porcentaje ?? null,
      precioCOP: item.precioCOP ?? null,
      precioUSD: item.precioUSD ?? null,
      precio: usaUsd ? (item.precioUSD ?? null) : (item.precioCOP ?? null),
      orden: item.orden ?? 0,
      vigenciaDesde: item.vigenciaDesde
        ? new Date(item.vigenciaDesde).toISOString()
        : null,
      vigenciaHasta: item.vigenciaHasta
        ? new Date(item.vigenciaHasta).toISOString()
        : null,
      informacion: (item.informacion as Record<string, unknown>) ?? null,
    };
  }

  async consultarPublica(
    q: PrecioExtraQueryDto,
  ): Promise<{ count: number; currency: 'COP' | 'USD'; data: PrecioExtraPublico[] }> {
    const currency = (q.currency ?? 'COP').toUpperCase() === 'USD' ? 'USD' : 'COP';
    const cacheKey = [
      q.hotelId ?? '',
      (q.ciudad ?? '').trim().toUpperCase(),
      q.concepto ?? '',
      currency,
    ].join('|');

    const cached = this.memGet(cacheKey);
    if (cached) return { count: cached.length, currency, data: cached };

    try {
      const items = await this.model
        .find({ activo: true })
        .sort({ orden: 1, _id: 1 })
        .lean()
        .exec();

      const rows: PrecioExtraPublico[] = [];
      for (const item of items) {
        if (!this.enVigencia(item)) continue;
        if (!this.aplicarScope(item, q)) continue;
        rows.push(this.toPublico(item, currency));
      }

      this.memSet(cacheKey, rows);
      return { count: rows.length, currency, data: rows };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
      return { count: 0, currency, data: [] };
    }
  }
}