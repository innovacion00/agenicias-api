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
import { ValidRoles } from 'src/auth/interfaces';

// TODO: Autenticar cada endpoint
@Controller('agencias')
export class AgenciasController {
  constructor(private readonly agenciasService: AgenciasService) {}

  @Post('create')
  create(@Body() createAgenciaDto: CreateAgenciaDto) {
    return this.agenciasService.create(createAgenciaDto);
  }

  @Get()
  @Auth(ValidRoles.superAdmin)
  findAll() {
    return this.agenciasService.findAll();
  }

  @Get('getByProperty')
  @Auth(ValidRoles.superAdmin)
  findOne(@Query('search') search: string) {
    return this.agenciasService.findByProperty(search);
  }

  // TODO: Hacer esto
  @Patch(':id')
  @Auth(ValidRoles.superAdmin)
  update(
    @Param('id') id: Types.ObjectId,
    @Body() updateAgenciaDto: UpdateAgenciaDto,
  ) {
    return this.agenciasService.update(id, updateAgenciaDto);
  }

  @Patch('switch-activation-agencia/:agenciaId')
  @Auth(ValidRoles.superAdmin)
  switchActivationAgency(
    @Param('agenciaId', ParseMongoIdPipe) agenciaId: Types.ObjectId,
  ) {
    return this.agenciasService.switchAgenciaStatus(agenciaId);
  }
}
