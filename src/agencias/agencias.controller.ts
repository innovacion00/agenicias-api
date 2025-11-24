import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AgenciasService } from './agencias.service';
import { ParseMongoIdPipe } from 'src/common/pipes';
import { Types } from 'mongoose';
import { Auth, GetUser } from 'src/auth/decorators';
import { ValidRoles } from 'src/auth/interfaces';
import { CreateAgenciaDto, RechargeWalletDto, UpdateAgenciaDto } from './dto';

@ApiTags('agencias')
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
  @ApiOperation({ summary: 'Obtener saldo de la billetera de la agencia' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Saldo de la agencia' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @Get('obtener-saldo')
  @Auth()
  obtenerSaldoBilletera(@GetUser('agencia') agencia: Types.ObjectId) {
    return this.agenciasService.obtenerSaldoBilletera(agencia);
  }

  //? Traer todas las agencias
  @ApiOperation({ summary: 'Obtener todas las agencias (solo superAdmin)' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de agencias' })
  @ApiResponse({ status: 403, description: 'Solo superAdmin' })
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
  @Get('agencias-con-reserva')
  @Auth(ValidRoles.superAdmin)
  getCountOfAgenciasReservas() {
    return this.agenciasService.getCountOfAgenciasReservas();
  }

  //? Obtener políticas de agencia por ID
  @ApiOperation({ summary: 'Obtener políticas de una agencia por ID' })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'ID de la agencia (MongoId)' })
  @ApiResponse({ status: 200, description: 'Políticas de la agencia' })
  @ApiResponse({ status: 404, description: 'Agencia no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @Get(':id/politicas')
  @Auth()
  obtenerPoliticasAgencia(@Param('id', ParseMongoIdPipe) id: Types.ObjectId) {
    return this.agenciasService.obtenerPoliticasAgencia(id);
  }

  //? Obtener nombre de agencia por ID
  @ApiOperation({ summary: 'Obtener el nombre de una agencia por ID' })
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'agenciaId', description: 'ID de la agencia (MongoId)' })
  @ApiResponse({ status: 200, description: 'Nombre de la agencia' })
  @ApiResponse({ status: 404, description: 'Agencia no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @Get(':agenciaId/nombre')
  @Auth()
  obtenerNombreAgencia(
    @Param('agenciaId', ParseMongoIdPipe) agenciaId: Types.ObjectId,
  ) {
    return this.agenciasService.obtenerNombreAgencia(agenciaId);
  }
}
