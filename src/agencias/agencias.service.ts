import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class AgenciasService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(AgenciasService.name);

  constructor(
    @InjectModel(Agencia.name)
    private readonly agenciaModel: Model<Agencia>,

    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,

    private readonly httpCustomService: HttpCustomService,
  ) {
    this.errorManager = new ErrorManager(AgenciasService.name);
  }

  // #region Crear una agencia
  async create(createAgenciaDto: CreateAgenciaDto) {
    createAgenciaDto.fullName = createAgenciaDto.fullName.toLowerCase();
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
      //? Cobre
      const bolsilloInfo = await this.httpCustomService.createBolcillo(
        createAgenciaDto.fullName,
      );

      const formattedNumber = parsePhoneNumber(
        createAgenciaDto.telefonoContacto,
      );

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

      //? Set limites de recarga en autocore
      await this.httpCustomService.setLimiteRecargaAgencia(
        autocoreAgenciaInfo.id,
        agenciaRecargaLimit.minLimitValue,
        agenciaRecargaLimit.maxLimitValue,
      );

      const cobreInfo = {
        bolcilloId: bolsilloInfo.id,
      };

      const agencia = await this.agenciaModel.create({
        slug,
        cobreInfo,
        autocoreInfo: {
          id: autocoreAgenciaInfo.id,
        },
        userLimit: createAgenciaDto.category === 0 ? 10 : 20,
        ...createAgenciaDto,
      });
      return {
        agencia,
      };
    } catch (error) {
      this.logger.error(error);
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
  async findAll() {
    try {
      const agencias = await this.agenciaModel.find().exec();
      return agencias;
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
}
