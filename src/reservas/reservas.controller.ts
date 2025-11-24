import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  Query,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { ReservasService } from './reservas.service';
import {
  DisponibilidadAutocoreDto,
  GenerateLinkDto,
  CreateReservaDto,
  CancelReservaDto,
  UpdateReservaDto,
  PagoReservaBilleteraDto,
} from './dto';
import { Auth, GetUser } from 'src/auth/decorators';
import { User } from 'src/auth/entities';
import { ParseMongoIdPipe } from 'src/common/pipes';
import { ParseCheckinCheckoutPipe, ParseHotelIdPipe } from './pipes';
import { ValidRoles } from 'src/auth/interfaces';

@ApiTags('reservas')
@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  // TODO: Volver esto a el auth de reservas despues
  // ValidRoles.admin,
  // ValidRoles.eventosSuperAdmin,
  // ValidRoles.user,
  // ValidRoles.superAdmin,
  @Post('reservar')
  @Auth()
  create(
    @Body(new ParseCheckinCheckoutPipe()) createReservaDto: CreateReservaDto,
    @Query('hotelId', ParseHotelIdPipe) hotelId: string,
    @GetUser('_id') _id: string,
  ) {
    return this.reservasService.createReserva(createReservaDto, hotelId, _id);
  }

  @Put('editar-reserva/:reservaId')
  @Auth()
  editarReserva(
    @Param('reservaId', ParseMongoIdPipe) reservaId: Types.ObjectId,
    @Body() updateReservaDto: UpdateReservaDto,
    @GetUser() user: User,
  ) {
    return this.reservasService.editarReserva(
      reservaId,
      updateReservaDto,
      user,
    );
  }

  @Delete('cancelar-reserva')
  @Auth()
  cancelarReserva(
    @Body() cancelReservaDto: CancelReservaDto,
    @GetUser() user: User,
  ) {
    return this.reservasService.cancelarReserva(cancelReservaDto, user);
  }

  @Post('/change-status')
  @HttpCode(200)
  cambiarEstadoPagoReserva(@Body() payload: any) {
    return this.reservasService.cambiarEstadoPagoAutocore(payload);
  }

  @ApiOperation({ summary: 'Obtener reservas del usuario autenticado' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de reservas del usuario' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @Get('/reservas-by-user')
  @Auth()
  getReservasByUser(@GetUser('_id') _id: Types.ObjectId) {
    return this.reservasService.getReservasByUser(_id);
  }

  @ApiOperation({ summary: 'Obtener reservas de la agencia (solo admin)' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de reservas de la agencia' })
  @ApiResponse({ status: 403, description: 'Solo admin' })
  @Get('reservas-by-agencia')
  @Auth(ValidRoles.admin)
  getReservasByAgencia(@GetUser('agencia') agencia: Types.ObjectId) {
    return this.reservasService.getReservasByAgencia(agencia);
  }

  @Post('generate-link')
  @Auth()
  generateLinkPago(
    @Body() generateLinkDto: GenerateLinkDto,
    @GetUser('agencia') agencia: Types.ObjectId,
  ) {
    return this.reservasService.generarLinkPago(generateLinkDto, agencia);
  }

  @Post('pago-billetera-single')
  @Auth()
  pagarSaldoBilletera(
    @Body() pagoReservaBilleteraDto: PagoReservaBilleteraDto,
  ) {
    return this.reservasService.realizarPagoBilletera(pagoReservaBilleteraDto);
  }

  @Post('pago-billetera-compuesto')
  @Auth()
  pagarAutocoreBalanceReserva(
    @Body() generateLinkDto: GenerateLinkDto,
    @GetUser('agencia') agencia: Types.ObjectId,
  ) {
    return this.reservasService.pagarAutocoreBalanceReserva(
      generateLinkDto,
      agencia,
    );
  }

  @Post('disponibilidad')
  @Auth()
  @HttpCode(200)
  getDisponibilidad(
    @GetUser('agencia') agencia: Types.ObjectId,
    @Body() disponibilidadAutoCoreDto: DisponibilidadAutocoreDto,
  ) {
    return this.reservasService.getDisponibilidad(
      agencia,
      disponibilidadAutoCoreDto,
    );
  }

  @Post('disponibilidad-debug')
  @Auth()
  @HttpCode(200)
  getDisponibilidadDebug(
    @GetUser() user: User,
    @GetUser('agencia') agencia: Types.ObjectId,
    @Body() disponibilidadAutoCoreDto: DisponibilidadAutocoreDto,
  ) {
    console.log('=== DEBUG DISPONIBILIDAD ===');
    console.log('User:', {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      agencia: user.agencia
    });
    console.log('Agencia ID:', agencia);
    console.log('Disponibilidad DTO:', disponibilidadAutoCoreDto);
    console.log('========================');
    
    return this.reservasService.getDisponibilidad(
      agencia,
      disponibilidadAutoCoreDto,
    );
  }

  // #region Administracion
  @Get()
  @Auth(ValidRoles.superAdmin)
  getAllReservas() {
    return this.reservasService.getAllReservas();
  }

  @Delete('cancelar-reserva-admin/:reservaId')
  @Auth(ValidRoles.superAdmin)
  cancelarReservaAdmin(
    @Param('reservaId', ParseMongoIdPipe) reservaId: Types.ObjectId,
  ) {
    return this.reservasService.cancelarReservaAdmin(reservaId);
  }

  // @Post('prueba')
  // prueba() {
  //   return this.reservasService.prueba();
  // }
}
