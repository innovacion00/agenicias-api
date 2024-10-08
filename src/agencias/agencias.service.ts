import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateAgenciaDto } from './dto/create-agencia.dto';
import { UpdateAgenciaDto } from './dto/update-agencia.dto';
import slugify from 'slugify';
import { InjectModel } from '@nestjs/mongoose';
import { Agencia } from './entities';
import { Model } from 'mongoose';

@Injectable()
export class AgenciasService {
  private readonly logger = new Logger(AgenciasService.name);

  constructor(
    @InjectModel(Agencia.name)
    private readonly agenciaModel: Model<Agencia>,
  ) {}

  private handleError(error: any): never {
    if (error.code === 11000) {
      throw new BadRequestException(
        `${JSON.stringify(error.keyValue)} existente en BD`,
      );
    }

    if (error instanceof NotFoundException) {
      throw error;
    }

    if (error instanceof BadRequestException) {
      throw error;
    }

    if (error instanceof UnauthorizedException) {
      throw error;
    }

    this.logger.log(error);
    throw new InternalServerErrorException('Revisar logs');
  }

  async create(createAgenciaDto: CreateAgenciaDto) {
    createAgenciaDto.fullName = createAgenciaDto.fullName.toLowerCase();
    try {
      const {} = createAgenciaDto;

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
      this.handleError(error);
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
