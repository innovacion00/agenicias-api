import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';
import slugify from 'slugify';
import parsePhoneNumber from 'libphonenumber-js';

import { Agencia } from './entities';
import { CreateAgenciaDto } from './dto/create-agencia.dto';
import { ErrorManager } from 'src/common/helpers';
import { UpdateAgenciaDto } from './dto/update-agencia.dto';
import { HttpCustomService } from 'src/common/services';
import { agenciaRecargaLimit } from 'src/config';
import { RechargeWalletDto } from './dto';
import { Reserva } from 'src/reservas/entities';
import { MaarlabCredentialsService } from 'src/maarlab-credentials/maarlab-credentials.service';

@Injectable()
export class AgenciasService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(AgenciasService.name);

  constructor(
    @InjectModel(Agencia.name)
    private readonly agenciaModel: Model<Agencia>,

    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,

    private readonly httpCustomService: HttpCustomService,

    private readonly maarlabCredentialsService: MaarlabCredentialsService,
  ) {
    this.errorManager = new ErrorManager(AgenciasService.name);
  }

  // #region Crear una agencia
  async create(createAgenciaDto: CreateAgenciaDto) {
    createAgenciaDto.fullName = createAgenciaDto.fullName.toLowerCase();
    this.logger.log(
      `[agencia-crear] Inicio: nombre="${createAgenciaDto.fullName}", email=${createAgenciaDto.emailContacto}, telefono=${createAgenciaDto.telefonoContacto}, category=${createAgenciaDto.category}`,
    );
    try {
      let slug = slugify(createAgenciaDto.fullName);
      let counter = 1;
      let slugValidation = await this.agenciaModel
        .findOne({ slug })
        .select('slug');

      while (slugValidation) {
        slug = `${slugify(createAgenciaDto.fullName, { lower: true })}-${counter}`;
        slugValidation = await this.agenciaModel
          .findOne({ slug })
          .select('slug');
        counter++;
      }
      this.logger.log(`[agencia-crear] Slug generado: "${slug}"`);

      //? Cobre
      this.logger.log('[agencia-crear] Creando bolcillo en Cobre...');
      const bolsilloInfo = await this.httpCustomService.createBolcillo(
        createAgenciaDto.fullName,
      );

      const formattedNumber = parsePhoneNumber(
        createAgenciaDto.telefonoContacto,
      );

      if (!formattedNumber) {
        throw new BadRequestException('Número de teléfono inválido');
      }

      if (!bolsilloInfo) {
        throw new InternalServerErrorException(
          'Error al crear bolsillo en Cobre',
        );
      }
      this.logger.log(
        `[agencia-crear] Bolcillo Cobre creado: id=${bolsilloInfo.id}`,
      );

      //? Autocore
      this.logger.log('[agencia-crear] Creando agencia en Autocore...');
      const autocoreAgenciaInfo =
        await this.httpCustomService.crearAgenciaAutocore({
          cobre_account_id: bolsilloInfo.id,
          country_code: formattedNumber.countryCallingCode,
          phone: formattedNumber.nationalNumber,
          document_number: createAgenciaDto.documentInfo.document.replace(
            /-/g,
            '',
          ),
          document_type: createAgenciaDto.documentInfo.tipo,
          email_for_notifications: createAgenciaDto.emailContacto,
          is_preloaded: true,
          name: createAgenciaDto.fullName,
        });

      if (!autocoreAgenciaInfo) {
        throw new InternalServerErrorException(
          'Error al crear agencia en Autocore',
        );
      }
      this.logger.log(
        `[agencia-crear] Agencia Autocore creada: id=${autocoreAgenciaInfo.id}`,
      );

      //? Set limites de recarga en autocore
      this.logger.log(
        `[agencia-crear] Seteando límites de recarga: min=${agenciaRecargaLimit.minLimitValue}, max=${agenciaRecargaLimit.maxLimitValue}`,
      );
      await this.httpCustomService.setLimiteRecargaAgencia(
        autocoreAgenciaInfo.id,
        agenciaRecargaLimit.minLimitValue,
        agenciaRecargaLimit.maxLimitValue,
      );
      this.logger.log('[agencia-crear] Límites de recarga seteados');

      const cobreInfo = {
        bolcilloId: bolsilloInfo.id,
      };

      const userLimit = createAgenciaDto.category === 0 ? 10 : 20;
      const agencia = await this.agenciaModel.create({
        slug,
        cobreInfo,
        autocoreInfo: {
          id: autocoreAgenciaInfo.id,
        },
        userLimit,
        ...createAgenciaDto,
      });
      this.logger.log(
        `[agencia-crear] Agencia guardada en MongoDB: id=${agencia._id}, slug="${slug}", userLimit=${userLimit}`,
      );
      this.logger.log(
        `[agencia-crear] ✅ Agencia creada exitosamente: "${createAgenciaDto.fullName}" (id=${agencia._id})`,
      );
      return {
        agencia,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[agencia-crear] ❌ Error: ${msg}`);
      this.errorManager.handle(error);
    }
  }

  // #region Recargar billetera autocore
  async recargarBilletera(
    rechargeWalletDto: RechargeWalletDto,
    agencia: Types.ObjectId,
  ) {
    try {
      if (!rechargeWalletDto.currency) {
        rechargeWalletDto.currency = 'COP';
      }

      const { currency, amount } = rechargeWalletDto;

      const agenciaInfo = await this.agenciaModel.findById(agencia);

      if (!agenciaInfo) {
        throw new NotFoundException('Agencia no encontrada');
      }

      const linkRecargaInfo =
        await this.httpCustomService.recargarCarteraAutocore(
          amount,
          currency,
          agenciaInfo.autocoreInfo.id,
        );

      return linkRecargaInfo;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async obtenerSaldoBilletera(agencia: Types.ObjectId) {
    try {
      const agenciaInfo = await this.agenciaModel.findById(agencia);

      if (!agenciaInfo) {
        throw new NotFoundException('Agencia no encontrada');
      }

      const agenciaSaldo = await this.httpCustomService.obtenerSaldoCartera(
        agenciaInfo.autocoreInfo.id,
      );

      return agenciaSaldo;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Encontrar todas las agencias
  async findAll(page = 1, limit = 15, fields?: string) {
    try {
      const PAGE_SIZE = Math.min(limit, 100); // Máximo 100 por página
      const currentPage = Math.max(1, page);
      const skip = (currentPage - 1) * PAGE_SIZE;

      // Campos por defecto (excluir datos sensibles)
      const selectFields = fields || '-cobreInfo -autocoreInfo -documentInfo';

      // OPTIMIZACIÓN: Agregar paginación, select y lean() para mejor rendimiento
      const [data, total] = await Promise.all([
        this.agenciaModel
          .find()
          .select(selectFields)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .lean(), // Mejor rendimiento al retornar objetos planos
        this.agenciaModel.countDocuments(),
      ]);

      return {
        data,
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

  // #region Encontrar agencia por termino
  async findByProperty(search: string) {
    const agencias = await this.agenciaModel.find({
      $or: [
        { fullName: { $regex: new RegExp(search, 'i') } },
        { emailContacto: { $regex: new RegExp(search, 'i') } },
        { telefonoContacto: { $regex: new RegExp(search, 'i') } },
        { slug: { $regex: new RegExp(search, 'i') } },
        { 'documentInfo.document': { $regex: new RegExp(search, 'i') } },
        { 'documentInfo.tipo': { $regex: new RegExp(search, 'i') } },
      ],
    });

    return agencias;
  }

  // #region Cambiar estado agencia
  async switchAgenciaStatus(agenciaId: Types.ObjectId) {
    try {
      const agenciaDoc = await this.agenciaModel.findById(agenciaId).exec();

      if (!agenciaDoc) {
        throw new NotFoundException('Agencia no encontrada');
      }

      await agenciaDoc.updateOne({
        ...agenciaDoc.toJSON(),
        isActive: !agenciaDoc.isActive,
      });

      return { ok: true };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Actualizar datos de agencia
  async updateAgencias(id: Types.ObjectId, updateAgenciaDto: UpdateAgenciaDto) {
    try {
      const agenciasDoc = await this.agenciaModel.findById(id);

      if (!agenciasDoc) {
        throw new NotFoundException('Agencia no encontrada');
      }

      await agenciasDoc.updateOne(updateAgenciaDto);

      return { id };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Cantidad de agencias con reservas
  async getCountOfAgenciasReservas() {
    try {
      const agencias = await this.reservasModel.aggregate([
        {
          $group: {
            _id: '$agenciaId',
            reserva: { $first: '$$ROOT' },
          },
        },
        {
          $count: 'agenciasConReserva',
        },
      ]);
      return agencias;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // TODO: Combertir esto en un find by term
  //#region Get agencias by date
  async getAgenciasBySearch(search: string) {
    try {
      const inicioDelDia = new Date(search);
      inicioDelDia.setUTCHours(0, 0, 0, 0);

      const finDelDia = new Date(search);
      finDelDia.setUTCHours(23, 59, 59, 999);

      const agencias = await this.agenciaModel.find({
        createdAt: {
          $gte: inicioDelDia,
          $lte: finDelDia,
        },
      });

      const cantidad = agencias.length;

      return { agencias, cantidad };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Obtener políticas de agencia
  async obtenerAgenciaPorId(agenciaId: Types.ObjectId) {
    try {
      const agencia = await this.agenciaModel.findById(agenciaId).lean().exec();

      if (!agencia) {
        throw new NotFoundException('Agencia no encontrada');
      }

      return agencia;
    } catch (error) {
      this.logger.error(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.errorManager.handle(error);
    }
  }

  // #region Obtener políticas de agencia
  async obtenerPoliticasAgencia(agenciaId: Types.ObjectId) {
    try {
      const agencia = await this.agenciaModel
        .findById(agenciaId)
        .select('politicasAgencia')
        .exec();

      if (!agencia) {
        throw new NotFoundException('Agencia no encontrada');
      }

      return {
        politicasAgencia: agencia.politicasAgencia || '',
      };
    } catch (error) {
      this.logger.error(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.errorManager.handle(error);
    }
  }

  // #region Obtener nombre de agencia
  async obtenerNombreAgencia(agenciaId: Types.ObjectId) {
    try {
      const agencia = await this.agenciaModel
        .findById(agenciaId)
        .select('fullName')
        .exec();

      if (!agencia) {
        throw new NotFoundException('Agencia no encontrada');
      }

      return {
        nombre: agencia.fullName,
      };
    } catch (error) {
      this.logger.error(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.errorManager.handle(error);
    }
  }

  /**
   * Bearer MaarLab / OceanFlights (Consolidator) configurado para la agencia.
   */
  async getMaarLabApiKeyOrThrow(agenciaId: Types.ObjectId): Promise<string> {
    const agencia = await this.agenciaModel
      .findById(agenciaId)
      .select('fullName maarlabApiKey')
      .lean()
      .exec();

    if (!agencia) {
      throw new NotFoundException('Agencia no encontrada');
    }

    return this.maarlabCredentialsService.resolveBearerForAgencia({
      _id: agencia._id,
      fullName: agencia.fullName,
      maarlabApiKey: agencia.maarlabApiKey,
    });
  }
}
