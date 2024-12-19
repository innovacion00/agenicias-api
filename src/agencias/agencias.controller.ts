import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { AgenciasService } from './agencias.service';
import { CreateAgenciaDto } from './dto/create-agencia.dto';
import { UpdateAgenciaDto } from './dto/update-agencia.dto';
import { ParseMongoIdPipe } from 'src/common/pipes';
import { Types } from 'mongoose';
import { Auth } from 'src/auth/decorators';

// TODO: Autenticar cada endpoint
@Controller('agencias')
export class AgenciasController {
  constructor(private readonly agenciasService: AgenciasService) {}

  @Post('create')
  create(@Body() createAgenciaDto: CreateAgenciaDto) {
    return this.agenciasService.create(createAgenciaDto);
  }

  @Auth()
  @Get()
  findAll() {
    return this.agenciasService.findAll();
  }

  @Get('getAll')
  findOne(@Query('search') search: string) {
    return this.agenciasService.findByProperty(search);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAgenciaDto: UpdateAgenciaDto) {
    return this.agenciasService.update(+id, updateAgenciaDto);
  }

  @Patch('switch-activation-agencia/:agenciaId')
  switchActivationAgency(
    @Param('agenciaId', ParseMongoIdPipe) agenciaId: Types.ObjectId,
  ) {
    return this.agenciasService.switchAgenciaStatus(agenciaId);
  }

  @Get('prueba/:agenciaId')
  prueba(@Param('agenciaId') agenciaId: Types.ObjectId) {
    return this.agenciasService.prueba(agenciaId);
  }
}
