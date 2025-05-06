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
import { ParseMongoIdPipe } from 'src/common/pipes';
import { Types } from 'mongoose';
import { Auth, GetUser } from 'src/auth/decorators';
import { ValidRoles } from 'src/auth/interfaces';
import { CreateAgenciaDto, RechargeWalletDto, UpdateAgenciaDto } from './dto';

@Controller('agencias')
export class AgenciasController {
  constructor(private readonly agenciasService: AgenciasService) {}

  //? Crear agencia
  @Post('create')
  create(@Body() createAgenciaDto: CreateAgenciaDto) {
    return this.agenciasService.create(createAgenciaDto);
  }

  //? Recargar cartera
  @Post('recharge-wallet')
  @Auth()
  recargarBilletera(
    @Body() rechargeWalletDto: RechargeWalletDto,
    @GetUser('agencia') agencia: Types.ObjectId,
  ) {
    return this.agenciasService.recargarBilletera(rechargeWalletDto, agencia);
  }

  //? Obtener saldo de agencia
  @Get('obtener-saldo')
  @Auth()
  obtenerSaldoBilletera(@GetUser('agencia') agencia: Types.ObjectId) {
    return this.agenciasService.obtenerSaldoBilletera(agencia);
  }

  //? Traer todas las agencias
  @Get()
  @Auth(ValidRoles.superAdmin)
  findAll() {
    return this.agenciasService.findAll();
  }

  //? Obtener agencias por propiedad
  @Get('getByProperty')
  @Auth(ValidRoles.superAdmin)
  findOne(@Query('search') search: string) {
    return this.agenciasService.findByProperty(search);
  }

  //? Actualizar informacion de agencia
  @Auth(ValidRoles.superAdmin)
  @Patch('update/:id')
  updateAgencia(
    @Param('id', ParseMongoIdPipe) id: Types.ObjectId,
    @Body() updateAgenciaDto: UpdateAgenciaDto,
  ) {
    return this.agenciasService.updateAgencias(id, updateAgenciaDto);
  }

  //? Cambiar estado de agencias
  @Patch('switch-activation-agencia/:agenciaId')
  @Auth(ValidRoles.superAdmin)
  switchActivationAgency(
    @Param('agenciaId', ParseMongoIdPipe) agenciaId: Types.ObjectId,
  ) {
    return this.agenciasService.switchAgenciaStatus(agenciaId);
  }

  //? Agencias creadas por dia
  @Get('agencies-by-term')
  getAgenciasBySearch(@Query('search') search: string) {
    return this.agenciasService.getAgenciasBySearch(search);
  }

  //? Agencias con reservas
  @Get("agencias-con-reserva")
  @Auth(ValidRoles.superAdmin)
  getCountOfAgenciasReservas() {
    return this.agenciasService.getCountOfAgenciasReservas();
  }
}
