import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';
import slugify from 'slugify';

import { Agencia } from './entities';
import { CreateAgenciaDto } from './dto/create-agencia.dto';
import { ErrorManager } from 'src/common/helpers';
import { UpdateAgenciaDto } from './dto/update-agencia.dto';

@Injectable()
export class AgenciasService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(AgenciasService.name);

  constructor(
    @InjectModel(Agencia.name)
    private readonly agenciaModel: Model<Agencia>,
  ) {
    this.errorManager = new ErrorManager(AgenciasService.name);
  }

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

      const agencia = await this.agenciaModel.create({
        slug,
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

  async findAll() {
    try {
      const agencias = await this.agenciaModel.find().exec();
      return agencias;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

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

  update(id: number, updateAgenciaDto: UpdateAgenciaDto) {
    return `This action updates a #${id} agencia`;
  }
}
