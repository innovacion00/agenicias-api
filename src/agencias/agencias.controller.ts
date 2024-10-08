import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AgenciasService } from './agencias.service';
import { CreateAgenciaDto } from './dto/create-agencia.dto';
import { UpdateAgenciaDto } from './dto/update-agencia.dto';

@Controller('agencias')
export class AgenciasController {
  constructor(private readonly agenciasService: AgenciasService) {}

  @Post('create')
  create(@Body() createAgenciaDto: CreateAgenciaDto) {
    return this.agenciasService.create(createAgenciaDto);
  }

  @Get()
  findAll() {
    return this.agenciasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.agenciasService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAgenciaDto: UpdateAgenciaDto) {
    return this.agenciasService.update(+id, updateAgenciaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.agenciasService.remove(+id);
  }
}
