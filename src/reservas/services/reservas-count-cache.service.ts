import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Reserva } from '../entities';

export interface ICountCache {
  getCachedCount(
    filter: Record<string, any>,
    useCache?: boolean,
  ): Promise<number>;
  getSumaTotalesNoCanceladas(useCache?: boolean): Promise<number>;
  calcularSumaTotalesPorFiltro(filter: Record<string, any>): Promise<number>;
  invalidateAll(): void;
  invalidateByFilter(filter: Record<string, any>): void;
}

@Injectable()
export class ReservasCountCacheService implements ICountCache {
  private readonly logger = new Logger(ReservasCountCacheService.name);

  private countCache: Map<string, { count: number; timestamp: number }> =
    new Map();
  private readonly CACHE_TTL = 60000;
  private readonly MAX_CACHE_SIZE = 1000;

  private sumaTotalesCache: { value: number; timestamp: number } | null = null;
  private readonly SUMA_CACHE_TTL = 60000;

  private sumaTotalesPorFiltroCache: Map<
    string,
    { value: number; timestamp: number }
  > = new Map();

  constructor(
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
  ) {}

  private buildCacheKey(filter: Record<string, any>): string {
    const sorted = Object.keys(filter)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = filter[key];
          return acc;
        },
        {} as Record<string, any>,
      );
    return JSON.stringify(sorted);
  }

  private setWithLRUEviction(
    key: string,
    value: { count: number; timestamp: number },
  ): void {
    if (this.countCache.has(key)) {
      this.countCache.delete(key);
    }
    this.countCache.set(key, value);

    if (this.countCache.size > this.MAX_CACHE_SIZE) {
      const firstKey = this.countCache.keys().next().value;
      if (firstKey) {
        this.countCache.delete(firstKey);
      }
    }
  }

  async getCachedCount(filter: any, useCache = true): Promise<number> {
    const cacheKey = this.buildCacheKey(filter);
    const cached = this.countCache.get(cacheKey);

    if (useCache && cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.count;
    }

    const isEmptyFilter = !filter || Object.keys(filter).length === 0;
    let count: number;

    if (isEmptyFilter) {
      try {
        count = await this.reservasModel.estimatedDocumentCount();
      } catch {
        count = await this.reservasModel.countDocuments(filter);
      }
    } else {
      count = await this.reservasModel.countDocuments(filter);
    }

    this.setWithLRUEviction(cacheKey, { count, timestamp: Date.now() });
    this.cleanOldCache();

    return count;
  }

  private cleanOldCache(): void {
    const now = Date.now();
    const maxAge = this.CACHE_TTL * 5;

    for (const [key, value] of this.countCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.countCache.delete(key);
      }
    }

    if (
      this.sumaTotalesCache &&
      now - this.sumaTotalesCache.timestamp > this.SUMA_CACHE_TTL * 5
    ) {
      this.sumaTotalesCache = null;
    }

    for (const [key, value] of this.sumaTotalesPorFiltroCache.entries()) {
      if (now - value.timestamp > this.SUMA_CACHE_TTL * 5) {
        this.sumaTotalesPorFiltroCache.delete(key);
      }
    }
  }

  async getSumaTotalesNoCanceladas(useCache = true): Promise<number> {
    if (
      useCache &&
      this.sumaTotalesCache &&
      Date.now() - this.sumaTotalesCache.timestamp < this.SUMA_CACHE_TTL
    ) {
      return this.sumaTotalesCache.value;
    }

    const sumaTotalesNoCanceladas = await this.reservasModel.aggregate([
      { $match: { status: { $ne: 4 } } },
      { $group: { _id: null, totalSum: { $sum: '$total' } } },
    ]);

    const totalSuma =
      sumaTotalesNoCanceladas.length > 0
        ? sumaTotalesNoCanceladas[0].totalSum
        : 0;

    this.sumaTotalesCache = { value: totalSuma, timestamp: Date.now() };
    return totalSuma;
  }

  async calcularSumaTotalesPorFiltro(
    filter: any,
    useCache = true,
  ): Promise<number> {
    const cacheKey = this.buildCacheKey(filter);
    const cached = this.sumaTotalesPorFiltroCache.get(cacheKey);

    if (
      useCache &&
      cached &&
      Date.now() - cached.timestamp < this.SUMA_CACHE_TTL
    ) {
      return cached.value;
    }

    try {
      const resultado = await this.reservasModel.aggregate([
        { $match: filter },
        { $group: { _id: null, totalSum: { $sum: '$total' } } },
      ]);

      const totalSuma = resultado.length > 0 ? resultado[0].totalSum : 0;

      if (this.sumaTotalesPorFiltroCache.size > this.MAX_CACHE_SIZE) {
        const firstKey = this.sumaTotalesPorFiltroCache.keys().next().value;
        if (firstKey) this.sumaTotalesPorFiltroCache.delete(firstKey);
      }

      this.sumaTotalesPorFiltroCache.set(cacheKey, {
        value: totalSuma,
        timestamp: Date.now(),
      });

      return totalSuma;
    } catch (error) {
      this.logger.error('Error al calcular suma de totales:', error);
      return 0;
    }
  }

  invalidateAll(): void {
    this.countCache.clear();
    this.sumaTotalesCache = null;
    this.sumaTotalesPorFiltroCache.clear();
  }

  invalidateByFilter(filter: Record<string, any>): void {
    const key = this.buildCacheKey(filter);
    this.countCache.delete(key);
    this.sumaTotalesPorFiltroCache.delete(key);
  }
}
