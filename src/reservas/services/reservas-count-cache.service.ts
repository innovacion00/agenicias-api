import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Reserva } from '../entities';

export interface ICountCache {
  getCachedCount(filter: Record<string, any>, useCache?: boolean): Promise<number>;
  getSumaTotalesNoCanceladas(useCache?: boolean): Promise<number>;
  calcularSumaTotalesPorFiltro(filter: Record<string, any>): Promise<number>;
}

@Injectable()
export class ReservasCountCacheService implements ICountCache {
  private readonly logger = new Logger(ReservasCountCacheService.name);

  // Caché para totales de documentos (evita recalcular en cada request)
  private countCache: Map<string, { count: number; timestamp: number }> =
    new Map();
  private readonly CACHE_TTL = 60000; // 1 minuto en milisegundos

  // Caché para suma de totales de reservas no canceladas
  private sumaTotalesCache: { value: number; timestamp: number } | null = null;
  private readonly SUMA_CACHE_TTL = 60000; // 1 minuto en milisegundos

  constructor(
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
  ) {}

  /**
   * Obtiene el total de documentos con caché
   * @param filter Filtro de búsqueda para generar clave de caché
   * @param useCache Si es false, fuerza recalcular
   */
  async getCachedCount(filter: any, useCache = true): Promise<number> {
    const cacheKey = JSON.stringify(filter);
    const cached = this.countCache.get(cacheKey);

    if (useCache && cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.debug(`Usando total en caché: ${cached.count}`);
      return cached.count;
    }

    // OPTIMIZACIÓN: Para queries sin filtros, usar estimatedDocumentCount (más rápido)
    const isEmptyFilter = !filter || Object.keys(filter).length === 0;
    let count: number;

    if (isEmptyFilter) {
      try {
        count = await this.reservasModel.estimatedDocumentCount();
        this.logger.debug(`Total estimado (sin filtros): ${count}`);
      } catch (error) {
        this.logger.warn(
          'Error al obtener estimatedDocumentCount, usando countDocuments',
        );
        count = await this.reservasModel.countDocuments(filter);
      }
    } else {
      count = await this.reservasModel.countDocuments(filter);
    }

    // Guardar en caché
    this.countCache.set(cacheKey, { count, timestamp: Date.now() });

    // Limpiar caché antiguo (más de 5 minutos)
    this.cleanOldCache();

    return count;
  }

  /**
   * Limpia entradas de caché antiguas
   */
  private cleanOldCache(): void {
    const now = Date.now();
    const maxAge = this.CACHE_TTL * 5; // 5 minutos

    for (const [key, value] of this.countCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.countCache.delete(key);
      }
    }

    // Limpiar caché de suma de totales si es antiguo
    if (
      this.sumaTotalesCache &&
      now - this.sumaTotalesCache.timestamp > this.SUMA_CACHE_TTL * 5
    ) {
      this.sumaTotalesCache = null;
    }
  }

  /**
   * Obtiene la suma de totales de reservas no canceladas con caché
   */
  async getSumaTotalesNoCanceladas(useCache = true): Promise<number> {
    // Verificar caché
    if (
      useCache &&
      this.sumaTotalesCache &&
      Date.now() - this.sumaTotalesCache.timestamp < this.SUMA_CACHE_TTL
    ) {
      this.logger.debug(
        `Usando suma de totales en caché: ${this.sumaTotalesCache.value}`,
      );
      return this.sumaTotalesCache.value;
    }

    // Calcular la suma usando agregación
    const sumaTotalesNoCanceladas = await this.reservasModel.aggregate([
      {
        $match: {
          status: { $ne: 4 }, // Excluir reservas canceladas (status = 4)
        },
      },
      {
        $group: {
          _id: null,
          totalSum: { $sum: '$total' },
        },
      },
    ]);

    const totalSuma =
      sumaTotalesNoCanceladas.length > 0
        ? sumaTotalesNoCanceladas[0].totalSum
        : 0;

    // Guardar en caché
    this.sumaTotalesCache = {
      value: totalSuma,
      timestamp: Date.now(),
    };

    this.logger.debug(`Suma de totales calculada: ${totalSuma}`);
    return totalSuma;
  }

  /**
   * Calcula la suma de totales de reservas que coinciden con un filtro
   * @param filter Filtro de búsqueda
   */
  async calcularSumaTotalesPorFiltro(filter: any): Promise<number> {
    try {
      const resultado = await this.reservasModel.aggregate([
        {
          $match: filter,
        },
        {
          $group: {
            _id: null,
            totalSum: { $sum: '$total' },
          },
        },
      ]);

      return resultado.length > 0 ? resultado[0].totalSum : 0;
    } catch (error) {
      this.logger.error('Error al calcular suma de totales:', error);
      return 0;
    }
  }
}
