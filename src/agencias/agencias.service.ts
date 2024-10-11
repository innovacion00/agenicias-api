import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';
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

  findAll() {
    return `This action returns all agencias`;
  }

  findOne(id: number) {
    return `This action returns a #${id} agencia`;
  }

  update(id: number, updateAgenciaDto: UpdateAgenciaDto) {
    return `This action updates a #${id} agencia`;
  }

  remove(id: number) {
    return `This action removes a #${id} agencia`;
  }
}
