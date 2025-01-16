import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';
import slugify from 'slugify';

import { Agencia } from './entities';
import { CreateAgenciaDto } from './dto/create-agencia.dto';
import { ErrorManager } from 'src/common/helpers';
import { UpdateAgenciaDto } from './dto/update-agencia.dto';
import { HttpCustomService } from 'src/common/services';

@Injectable()
export class AgenciasService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(AgenciasService.name);

  constructor(
    @InjectModel(Agencia.name)
    private readonly agenciaModel: Model<Agencia>,

    private readonly httpCustomService: HttpCustomService,
  ) {
    this.errorManager = new ErrorManager(AgenciasService.name);
  }

  // #region Crear agencia
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
      // ? Cobre
      const bolsilloInfo = await this.httpCustomService.createBolcillo(
        createAgenciaDto.fullName,
      );
      const counterPartyInfo = await this.httpCustomService.createCounterParty(
        createAgenciaDto.fullName,
        createAgenciaDto.emailContacto,
        createAgenciaDto.documentInfo.document.replace(/-/g, ''),
        createAgenciaDto.documentInfo.tipo,
        createAgenciaDto.telefonoContacto,
      );

      const cobreInfo = {
        counterPartyId: counterPartyInfo.id,
        bolcilloId: bolsilloInfo.id,
      };

      const agencia = await this.agenciaModel.create({
        slug,
        cobreInfo,
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

  // TODO Borrar
  // async camiarUserLimits() {
  //   return { hola: 'hola' };
  // }
}
