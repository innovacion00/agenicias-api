import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { ErrorManager } from 'src/common/helpers';
import { Agencia } from 'src/agencias/entities';
import { User } from 'src/auth/entities';

import { Reserva } from '../entities';
import { ValidPaymentStatus } from '../interfaces';
import { MyToolBookingService } from './my-tool-booking.service';
import { ReservasCountCacheService } from './reservas-count-cache.service';

const PAGE_SIZE = 15;
// OPTIMIZACIÓN: Limitar skip máximo para evitar queries muy lentas
const MAX_SKIP = 10000;
const HARD_LIMIT_ALL = 500;

@Injectable()
export class ReservasSearchService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(ReservasSearchService.name);

  constructor(
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
    private readonly countCache: ReservasCountCacheService,
    private readonly myToolBookingService: MyToolBookingService,
  ) {
    this.errorManager = new ErrorManager(ReservasSearchService.name);
  }

  /**
   * Compatibilidad con datos legacy:
   * algunas reservas antiguas pueden tener IDs persistidos como string.
   * Construimos filtros que aceptan ObjectId y su representación string.
   */
  private buildIdFilter(
    field: 'userId' | 'agenciaId',
    id: Types.ObjectId | string,
  ): Record<string, any> {
    const idAsString = typeof id === 'string' ? id : id.toString();

    if (!Types.ObjectId.isValid(idAsString)) {
      return { [field]: idAsString };
    }

    const objectId =
      id instanceof Types.ObjectId ? id : new Types.ObjectId(idAsString);

    return { [field]: { $in: [objectId, idAsString] } };
  }

  /**
   * Helper para construir filtro base según el rol del usuario
   */
  private construirFiltroPorRol(
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
  ): any {
    const esSuperAdmin = roles.includes('super-admin');
    const esAdmin = roles.includes('admin');

    if (esSuperAdmin) {
      // SuperAdmin: sin filtros, puede ver todas las reservas
      return {};
    } else if (esAdmin) {
      // Admin: solo reservas de su agencia
      return this.buildIdFilter('agenciaId', agenciaId);
    } else {
      // User: solo sus propias reservas
      return this.buildIdFilter('userId', userId);
    }
  }

  /**
   * Escapa metacaracteres de regex para usar un texto como literal en $regex.
   */
  private escapeRegex(texto: string): string {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Valida que un texto sea un patrón de regex sintácticamente válido
   * (paréntesis/corchetes balanceados, etc.) antes de escaparlo y usarlo.
   */
  private esRegexValida(patron: string): boolean {
    try {
      new RegExp(patron);
      return true;
    } catch {
      return false;
    }
  }

  //? Buscar reserva por reservaChatbotId
  // Nota: reservaChatbotId es único, por lo tanto la búsqueda es exacta
  // No requiere paginación porque siempre retorna 0 o 1 resultado
  async buscarPorChatbotId(
    reservaChatbotId: string,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
  ): Promise<{
    data: any | null;
    found: boolean;
    sumaTotales?: number;
  }> {
    try {
      const filtroRol = this.construirFiltroPorRol(userId, agenciaId, roles);

      // Búsqueda exacta (reservaChatbotId es único)
      const filtroBusqueda = {
        ...filtroRol,
        reservaChatbotId: reservaChatbotId, // Búsqueda exacta, sin regex
      };

      const reserva = await this.reservasModel
        .findOne(filtroBusqueda)
        .populate('agenciaId', 'fullName _id emailContacto')
        .populate('userId', 'fullName email')
        .lean();

      return {
        data: reserva,
        found: !!reserva,
        sumaTotales: reserva ? reserva.total : 0, // Si existe, devolver su total
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  //? Buscar reservas por nombre del agente
  async buscarPorNombreAgente(
    nombreAgente: string,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
    page = 1,
    all = false,
  ): Promise<{
    data: any[];
    meta: {
      total: number;
      page?: number;
      pageSize?: number;
      totalPages?: number;
      sumaTotales?: number;
      deprecationWarning?: string;
    };
  }> {
    try {
      const filtroRol = this.construirFiltroPorRol(userId, agenciaId, roles);
      const esSuperAdmin = roles.includes('super-admin');
      const esAdmin = roles.includes('admin');

      // Validar el patrón antes de usarlo: si no es una regex válida, no hay
      // resultados posibles (evita 500 por regex inválida en el motor).
      if (!this.esRegexValida(nombreAgente)) {
        return {
          data: [],
          meta: {
            total: 0,
            ...(all ? {} : { page: 1, pageSize: 15, totalPages: 0 }),
          },
        };
      }

      // Escapar caracteres especiales para que el patrón se interprete como
      // texto literal (fix intencional A3 / divergencia 4).
      const nombreEscapado = this.escapeRegex(nombreAgente);

      // Construir filtro para buscar usuarios según el rol
      const filtroUsuario: any = {
        fullName: { $regex: nombreEscapado, $options: 'i' },
      };

      // Si es admin, solo buscar usuarios de su agencia
      if (esAdmin && !esSuperAdmin) {
        filtroUsuario.agencia = agenciaId;
      }
      // Si es user, solo puede buscar su propio nombre
      if (!esAdmin && !esSuperAdmin) {
        filtroUsuario._id = userId;
      }

      // Buscar usuarios que coincidan con el nombre
      const usuarios = await this.userModel
        .find(filtroUsuario)
        .select('_id')
        .lean();

      const userIds = usuarios.map((user) => user._id);

      if (userIds.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            ...(all ? {} : { page: 1, pageSize: 15, totalPages: 0 }),
          },
        };
      }

      // Aplicar filtro de rol a las reservas
      const filtroBusqueda = {
        ...filtroRol,
        userId: { $in: userIds },
      };

      // Calcular suma de totales para las reservas que coinciden con el filtro
      const sumaTotales =
        await this.countCache.calcularSumaTotalesPorFiltro(filtroBusqueda);

      // Si all=true, retornar con límite duro (deprecado)
      if (all) {
        const [reservas, total] = await Promise.all([
          this.reservasModel
            .find(filtroBusqueda)
            .populate('agenciaId', 'fullName _id emailContacto')
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(HARD_LIMIT_ALL)
            .lean(),
          this.countCache.getCachedCount(filtroBusqueda),
        ]);

        return {
          data: reservas,
          meta: {
            total,
            sumaTotales,
            deprecationWarning:
              'all=true será eliminado en v2. Use paginación.',
          },
        };
      }

      // Paginación normal
      const currentPage = Number(page) > 0 ? Number(page) : 1;
      const skip = Math.min((currentPage - 1) * PAGE_SIZE, MAX_SKIP);

      const [reservas, total] = await Promise.all([
        this.reservasModel
          .find(filtroBusqueda)
          .populate('agenciaId', 'fullName _id emailContacto')
          .populate('userId', 'fullName email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .lean(),
        this.countCache.getCachedCount(filtroBusqueda),
      ]);

      return {
        data: reservas,
        meta: {
          total,
          page: currentPage,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE) || 1,
          sumaTotales,
        },
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  //? Buscar reservas por nombre de agencia
  async buscarPorNombreAgencia(
    nombreAgencia: string,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
    page = 1,
    all = false,
  ): Promise<{
    data: any[];
    meta: {
      total: number;
      page?: number;
      pageSize?: number;
      totalPages?: number;
      sumaTotales?: number;
      deprecationWarning?: string;
    };
  }> {
    try {
      const filtroRol = this.construirFiltroPorRol(userId, agenciaId, roles);
      const esSuperAdmin = roles.includes('super-admin');

      // Validar el patrón antes de usarlo: si no es una regex válida, no hay
      // resultados posibles (evita 500 por regex inválida en el motor).
      if (!this.esRegexValida(nombreAgencia)) {
        return {
          data: [],
          meta: {
            total: 0,
            ...(all ? {} : { page: 1, pageSize: 15, totalPages: 0 }),
          },
        };
      }

      // Escapar caracteres especiales para que el patrón se interprete como
      // texto literal (fix intencional A3 / divergencia 4).
      const nombreEscapado = this.escapeRegex(nombreAgencia);

      // Construir filtro para buscar agencias según el rol
      const filtroAgencia: any = {
        fullName: { $regex: nombreEscapado, $options: 'i' },
      };

      // Si es admin o user, solo puede buscar su propia agencia
      if (!esSuperAdmin) {
        filtroAgencia._id = agenciaId;
      }

      // Buscar agencias que coincidan con el nombre
      const agencias = await this.agenciaModel
        .find(filtroAgencia)
        .select('_id')
        .lean();

      const agenciaIds = agencias.map((agencia) => agencia._id);

      if (agenciaIds.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            ...(all ? {} : { page: 1, pageSize: 15, totalPages: 0 }),
          },
        };
      }

      // Aplicar filtro de rol a las reservas
      const filtroBusqueda = {
        ...filtroRol,
        agenciaId: { $in: agenciaIds },
      };

      // Calcular suma de totales para las reservas que coinciden con el filtro
      const sumaTotales =
        await this.countCache.calcularSumaTotalesPorFiltro(filtroBusqueda);

      // Si all=true, retornar con límite duro (deprecado)
      if (all) {
        const [reservas, total] = await Promise.all([
          this.reservasModel
            .find(filtroBusqueda)
            .populate('agenciaId', 'fullName _id emailContacto')
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(HARD_LIMIT_ALL)
            .lean(),
          this.countCache.getCachedCount(filtroBusqueda),
        ]);

        return {
          data: reservas,
          meta: {
            total,
            sumaTotales,
            deprecationWarning:
              'all=true será eliminado en v2. Use paginación.',
          },
        };
      }

      // Paginación normal
      const currentPage = Number(page) > 0 ? Number(page) : 1;
      const skip = Math.min((currentPage - 1) * PAGE_SIZE, MAX_SKIP);

      const [reservas, total] = await Promise.all([
        this.reservasModel
          .find(filtroBusqueda)
          .populate('agenciaId', 'fullName _id emailContacto')
          .populate('userId', 'fullName email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .lean(),
        this.countCache.getCachedCount(filtroBusqueda),
      ]);

      return {
        data: reservas,
        meta: {
          total,
          page: currentPage,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE) || 1,
          sumaTotales,
        },
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  //? Buscar reservas por nombre del huésped
  async buscarPorNombreHuesped(
    nombreHuesped: string,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
    page = 1,
    all = false,
  ): Promise<{
    data: any[];
    meta: {
      total: number;
      page?: number;
      pageSize?: number;
      totalPages?: number;
      sumaTotales?: number;
      deprecationWarning?: string;
    };
  }> {
    try {
      const filtroRol = this.construirFiltroPorRol(userId, agenciaId, roles);

      // Normalizar el texto de búsqueda: eliminar espacios extra
      const nombreLimpio = nombreHuesped.trim().replace(/\s+/g, ' ');

      // Escapar caracteres especiales para regex de forma segura
      const nombreEscapado = this.escapeRegex(nombreLimpio);

      // Dividir el nombre en partes (por si es nombre completo como "Juan Pérez")
      const partesNombre = nombreLimpio
        .split(/\s+/)
        .filter((p) => p.length > 0);

      // Construir condiciones de búsqueda
      const condicionesBusqueda: any[] = [
        // Búsqueda en firstName (case-insensitive)
        { 'reservation.firstName': { $regex: nombreEscapado, $options: 'i' } },
        // Búsqueda en lastName (case-insensitive)
        { 'reservation.lastName': { $regex: nombreEscapado, $options: 'i' } },
      ];

      // Si hay múltiples palabras, buscar también en la combinación
      if (partesNombre.length > 1) {
        // Buscar si alguna parte coincide con firstName y otra con lastName
        // Ejemplo: "Juan Pérez" busca firstName="Juan" AND lastName contiene "Pérez"
        // o firstName contiene "Pérez" AND lastName="Juan"
        partesNombre.forEach((parte, index) => {
          const parteEscapada = this.escapeRegex(parte);
          const otrasPartes = partesNombre
            .filter((_, i) => i !== index)
            .map((p) => this.escapeRegex(p))
            .join('|');

          condicionesBusqueda.push({
            $and: [
              {
                'reservation.firstName': {
                  $regex: parteEscapada,
                  $options: 'i',
                },
              },
              {
                'reservation.lastName': { $regex: otrasPartes, $options: 'i' },
              },
            ],
          });
        });

        // Buscar en la concatenación completa usando $expr (firstName + " " + lastName)
        const nombreCompletoRegex = partesNombre
          .map((p) => this.escapeRegex(p))
          .join('.*');
        condicionesBusqueda.push({
          $expr: {
            $regexMatch: {
              input: {
                $concat: [
                  { $ifNull: ['$reservation.firstName', ''] },
                  ' ',
                  { $ifNull: ['$reservation.lastName', ''] },
                ],
              },
              regex: nombreCompletoRegex,
              options: 'i',
            },
          },
        });
      }

      // Buscar por firstName, lastName o combinación en reservation
      const filtroBusqueda = {
        ...filtroRol,
        $or: condicionesBusqueda,
      };

      // Calcular suma de totales para las reservas que coinciden con el filtro
      const sumaTotales =
        await this.countCache.calcularSumaTotalesPorFiltro(filtroBusqueda);

      // Si all=true, retornar con límite duro (deprecado)
      if (all) {
        const [reservas, total] = await Promise.all([
          this.reservasModel
            .find(filtroBusqueda)
            .populate('agenciaId', 'fullName _id emailContacto')
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(HARD_LIMIT_ALL)
            .lean(),
          this.countCache.getCachedCount(filtroBusqueda),
        ]);

        return {
          data: reservas,
          meta: {
            total,
            sumaTotales,
            deprecationWarning:
              'all=true será eliminado en v2. Use paginación.',
          },
        };
      }

      // Paginación normal
      const currentPage = Number(page) > 0 ? Number(page) : 1;
      const skip = Math.min((currentPage - 1) * PAGE_SIZE, MAX_SKIP);

      const [reservas, total] = await Promise.all([
        this.reservasModel
          .find(filtroBusqueda)
          .populate('agenciaId', 'fullName _id emailContacto')
          .populate('userId', 'fullName email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .lean(),
        this.countCache.getCachedCount(filtroBusqueda),
      ]);

      return {
        data: reservas,
        meta: {
          total,
          page: currentPage,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE) || 1,
          sumaTotales,
        },
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  //? Buscar reservas por estado
  async buscarPorEstado(
    status: ValidPaymentStatus,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
    page = 1,
    all = false,
  ): Promise<{
    data: any[];
    meta: {
      total: number;
      page?: number;
      pageSize?: number;
      totalPages?: number;
      sumaTotales?: number;
      deprecationWarning?: string;
    };
  }> {
    try {
      const filtroRol = this.construirFiltroPorRol(userId, agenciaId, roles);

      const filtroBusqueda = {
        ...filtroRol,
        status,
      };

      // Calcular suma de totales para las reservas que coinciden con el filtro
      const sumaTotales =
        await this.countCache.calcularSumaTotalesPorFiltro(filtroBusqueda);

      // Si all=true, retornar con límite duro (deprecado)
      if (all) {
        const [reservas, total] = await Promise.all([
          this.reservasModel
            .find(filtroBusqueda)
            .populate('agenciaId', 'fullName _id emailContacto')
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(HARD_LIMIT_ALL)
            .lean(),
          this.countCache.getCachedCount(filtroBusqueda),
        ]);

        return {
          data: reservas,
          meta: {
            total,
            sumaTotales,
            deprecationWarning:
              'all=true será eliminado en v2. Use paginación.',
          },
        };
      }

      // Paginación normal
      const currentPage = Number(page) > 0 ? Number(page) : 1;
      const skip = Math.min((currentPage - 1) * PAGE_SIZE, MAX_SKIP);

      const [reservas, total] = await Promise.all([
        this.reservasModel
          .find(filtroBusqueda)
          .populate('agenciaId', 'fullName _id emailContacto')
          .populate('userId', 'fullName email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .lean(),
        this.countCache.getCachedCount(filtroBusqueda),
      ]);

      return {
        data: reservas,
        meta: {
          total,
          page: currentPage,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE) || 1,
          sumaTotales,
        },
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async getReservasByUser(userId: Types.ObjectId | string, page = 1) {
    try {
      const currentPage = Number(page) > 0 ? Number(page) : 1;
      const skip = Math.min((currentPage - 1) * PAGE_SIZE, MAX_SKIP);

      // Asegurar que userId sea un ObjectId válido para la búsqueda
      // Esto funciona tanto para reservas existentes como nuevas
      let userIdObjectId: Types.ObjectId;

      if (userId instanceof Types.ObjectId) {
        userIdObjectId = userId;
      } else if (typeof userId === 'string') {
        // Validar que sea un ObjectId válido antes de crear
        if (!Types.ObjectId.isValid(userId)) {
          throw new BadRequestException('ID de usuario inválido');
        }
        userIdObjectId = new Types.ObjectId(userId);
      } else {
        throw new BadRequestException('Formato de ID de usuario no válido');
      }

      const filter = this.buildIdFilter('userId', userIdObjectId);

      // OPTIMIZACIÓN: Usar caché para el total y optimizar query con índices
      const [reservas, total] = await Promise.all([
        this.reservasModel
          .find(filter)
          .populate('agenciaId', 'fullName _id emailContacto')
          .populate('userId', 'fullName email')
          .sort({ createdAt: -1 }) // Usa índice compuesto { userId: 1, status: 1, createdAt: -1 }
          .skip(skip)
          .limit(PAGE_SIZE)
          .lean(), // Mejor rendimiento al retornar objetos planos
        this.countCache.getCachedCount(filter), // Usa caché para el total
      ]);

      return {
        data: reservas,
        meta: {
          total,
          page: currentPage,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE) || 1,
        },
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async getReservasByAgencia(agenciaId: Types.ObjectId, page = 1) {
    try {
      const currentPage = Number(page) > 0 ? Number(page) : 1;
      const skip = Math.min((currentPage - 1) * PAGE_SIZE, MAX_SKIP);

      const filter = this.buildIdFilter('agenciaId', agenciaId);

      // OPTIMIZACIÓN: Agregar select y lean() para mejor rendimiento
      const [reservas, total] = await Promise.all([
        this.reservasModel
          .find(filter)
          .populate('userId', 'fullName email')
          .populate('agenciaId', 'fullName _id')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .lean(), // Mejor rendimiento al retornar objetos planos
        this.countCache.getCachedCount(filter),
      ]);

      return {
        data: reservas,
        meta: {
          total,
          page: currentPage,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE) || 1,
        },
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  //? Obtener todas las reservas
  async getAllReservas(
    page = 1,
    all = false,
    hotel?: string,
    nombreAgencia?: string,
    fechaDesde?: string,
    fechaHasta?: string,
  ) {
    try {
      // Construir el filtro
      const filter: any = {};

      // Si se proporciona el parámetro hotel, agregarlo al filtro
      if (hotel && hotel.trim()) {
        // Búsqueda case-insensitive y parcial del nombre del hotel
        filter.hotel = {
          $regex: this.escapeRegex(hotel.trim()),
          $options: 'i',
        };
      }

      // Filtro por nombre de agencia (solo para superAdmin)
      if (nombreAgencia && nombreAgencia.trim()) {
        // Buscar agencias que coincidan con el nombre
        const filtroAgencia: any = {
          fullName: {
            $regex: this.escapeRegex(nombreAgencia.trim()),
            $options: 'i',
          },
        };

        const agencias = await this.agenciaModel
          .find(filtroAgencia)
          .select('_id')
          .lean();

        const agenciaIds = agencias.map((agencia) => agencia._id);

        if (agenciaIds.length === 0) {
          // Si no se encuentran agencias, retornar vacío
          return {
            data: [],
            meta: {
              total: 0,
              ...(all ? {} : { page: 1, pageSize: 15, totalPages: 0 }),
              sumaTotalesNoCanceladas: 0,
              ...(hotel && { hotelFiltrado: hotel }),
              ...(nombreAgencia && { nombreAgenciaFiltrado: nombreAgencia }),
            },
          };
        }

        filter.agenciaId = { $in: agenciaIds };
      }

      // Filtro por fecha de checkin (fechaDesde y/o fechaHasta)
      if (fechaDesde || fechaHasta) {
        // El checkin está almacenado como string en formato YYYY-MM-DD
        // Usamos comparación de strings ya que el formato es ISO (YYYY-MM-DD)
        if (fechaDesde && fechaHasta) {
          // Rango completo: desde fechaDesde hasta fechaHasta
          filter['reservation.checkin'] = {
            $gte: fechaDesde.trim(),
            $lte: fechaHasta.trim(),
          };
        } else if (fechaDesde) {
          // Solo fechaDesde: filtrar solo ese día específico
          filter['reservation.checkin'] = fechaDesde.trim();
        } else if (fechaHasta) {
          // Solo fechaHasta: checkin <= fechaHasta
          filter['reservation.checkin'] = {
            $lte: fechaHasta.trim(),
          };
        }
      }

      // Obtener la suma de totales de reservas no canceladas (con caché)
      const totalSuma = await this.countCache.getSumaTotalesNoCanceladas();

      // Si all=true, retornar con límite duro (deprecado)
      if (all) {
        const [allReservas, total] = await Promise.all([
          this.reservasModel
            .find(filter)
            .populate('agenciaId', 'fullName _id')
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(HARD_LIMIT_ALL)
            .lean(),
          this.countCache.getCachedCount(filter),
        ]);

        return {
          data: allReservas,
          meta: {
            total,
            sumaTotalesNoCanceladas: totalSuma,
            ...(hotel && { hotelFiltrado: hotel }),
            ...(nombreAgencia && { nombreAgenciaFiltrado: nombreAgencia }),
            ...(fechaDesde && { fechaDesde }),
            ...(fechaHasta && { fechaHasta }),
            deprecationWarning:
              'all=true será eliminado en v2. Use paginación.',
          },
        };
      }

      // Paginación normal
      const currentPage = Number(page) > 0 ? Number(page) : 1;
      const skip = Math.min((currentPage - 1) * PAGE_SIZE, MAX_SKIP);

      // OPTIMIZACIÓN: Usar caché para el total y optimizar query
      const [allReservas, total] = await Promise.all([
        this.reservasModel
          .find(filter)
          .populate('agenciaId', 'fullName _id')
          .populate('userId', 'fullName email')
          .sort({ createdAt: -1 }) // Usa índice { status: 1, createdAt: -1 }
          .skip(skip)
          .limit(PAGE_SIZE)
          .lean(), // Mejor rendimiento al retornar objetos planos
        this.countCache.getCachedCount(filter), // Usa caché para el total (estimatedDocumentCount si no hay filtros)
      ]);

      return {
        data: allReservas,
        meta: {
          total,
          page: currentPage,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE) || 1,
          sumaTotalesNoCanceladas: totalSuma,
          ...(hotel && { hotelFiltrado: hotel }),
          ...(nombreAgencia && { nombreAgenciaFiltrado: nombreAgencia }),
          ...(fechaDesde && { fechaDesde }),
          ...(fechaHasta && { fechaHasta }),
        },
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  //? Buscar reserva en My Tool por localizador o nombre
  async searchReservaMyTool(
    hotelSlug: string,
    localizador: string,
    nombre: string,
  ) {
    try {
      return await this.myToolBookingService.searchBooking(
        hotelSlug,
        localizador,
        nombre,
      );
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }
}
