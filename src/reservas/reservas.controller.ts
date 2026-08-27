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
  BadRequestException,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiExtraModels,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { ReservasService } from './reservas.service';
import {
  DisponibilidadAutocoreDto,
  GenerateLinkDto,
  CreateReservaDto,
  CancelReservaDto,
  ComprobanteEnviadoDto,
  UpdateReservaDto,
  PagoReservaBilleteraDto,
  UpdateReservaStatusDto,
  UpdateFechasPagoDto,
  ReactivarReservaDto,
  ActualizarAbonoDto,
  ReprocessWebhookPagoDto,
} from './dto';
import { Auth, GetUser } from 'src/auth/decorators';
import { User } from 'src/auth/entities';
import { ParseMongoIdPipe } from 'src/common/pipes';
import {
  ParseCheckinCheckoutPipe,
  ParseHotelIdPipe,
  ParseHotelSlugPipe,
} from './pipes';
import { ValidRoles } from 'src/auth/interfaces';
import { ValidPaymentStatus } from './interfaces';
import {
  CreateReservaMyToolDto,
  CancelReservaMyToolDto,
  SearchReservaMyToolDto,
} from './dto/create-reserva-mytool.dto';
import type { MyToolBookingResponse } from './services/my-tool-booking.service';
import { RoomsDataResponseInterceptor } from './interceptors/rooms-data-response.interceptor';

@ApiTags('reservas')
@ApiExtraModels(
  CreateReservaMyToolDto,
  CancelReservaMyToolDto,
  SearchReservaMyToolDto,
)
@UseInterceptors(RoomsDataResponseInterceptor)
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
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook Autocore — cambio de estado de pago' })
  cambiarEstadoPagoReserva(
    @Body()
    payload: {
      external_ref_id: string;
      transaction_id?: string;
      payment_status: string;
      details: {
        id: string;
        pay_platform?: string;
      };
    },
  ) {
    return this.reservasService.cambiarEstadoPagoAutocore(payload);
  }

  @Post('reprocess-webhook/:reservaId')
  @Auth(ValidRoles.superAdmin)
  @ApiOperation({
    summary: 'Reprocesar webhook de pago (superAdmin)',
    description:
      'Aplica manualmente la lógica del webhook Autocore sobre una reserva. ' +
      'Útil cuando el pago se confirmó pero el estado no se reflejó.',
  })
  @ApiBearerAuth('JWT-auth')
  reprocesarWebhookPago(
    @Param('reservaId', ParseMongoIdPipe) reservaId: Types.ObjectId,
    @Body(new ValidationPipe({ transform: true }))
    dto: ReprocessWebhookPagoDto,
  ) {
    return this.reservasService.reprocesarWebhookPago(reservaId, dto);
  }

  @ApiOperation({ summary: 'Obtener reservas del usuario autenticado' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de reservas del usuario' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @Get('/reservas-by-user')
  @Auth()
  getReservasByUser(
    @GetUser('_id') _id: Types.ObjectId,
    @Query('page') page = 1,
  ) {
    return this.reservasService.getReservasByUser(_id, page);
  }

  @ApiOperation({ summary: 'Obtener reservas de la agencia (solo admin)' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de reservas de la agencia' })
  @ApiResponse({ status: 403, description: 'Solo admin' })
  @Get('reservas-by-agencia')
  @Auth(ValidRoles.admin)
  getReservasByAgencia(
    @GetUser('agencia') agencia: Types.ObjectId,
    @Query('page') page = 1,
  ) {
    return this.reservasService.getReservasByAgencia(agencia, page);
  }

  @Post('generate-link')
  @Auth()
  generateLinkPago(
    @Body() generateLinkDto: GenerateLinkDto,
    @GetUser('agencia') agencia: Types.ObjectId,
  ) {
    return this.reservasService.generarLinkPago(generateLinkDto, agencia);
  }

  @Post('reactivar')
  @Auth()
  @ApiOperation({
    summary: 'Reactivar reserva cancelada (Autocore)',
    description:
      'Clona una reserva cancelada en Autocore y genera link de pago según saldo previo: ' +
      'si pagadoPrimeraMitad=true usa totalMitad; si no, consulta el PMS My Tool (GetEstadoCuentaReserva) ' +
      'para calcular el monto (totalMitad, total - abonos, o rechaza si ya está pagada). ' +
      'Programa expiración a 24h.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Link de pago generado' })
  @ApiResponse({
    status: 409,
    description:
      'Sin disponibilidad (REACTIVACION_SIN_DISPONIBILIDAD) o reserva ya pagada (REACTIVACION_YA_PAGADA)',
  })
  reactivarReservaCancelada(
    @Body() reactivarReservaDto: ReactivarReservaDto,
    @GetUser() user: User,
  ) {
    return this.reservasService.reactivarReservaCancelada(
      reactivarReservaDto,
      user,
    );
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
    return this.reservasService.getDisponibilidad(
      agencia,
      disponibilidadAutoCoreDto,
    );
  }

  // #region Búsquedas
  @ApiOperation({
    summary: 'Buscar reservas por reservaChatbotId',
    description:
      'Busca reservas por ID del chatbot. Primero intenta búsqueda exacta, luego parcial. No requiere paginación ya que retorna todos los resultados encontrados (máximo 100).',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de reservas encontradas' })
  @Get('buscar/chatbot-id')
  @Auth()
  buscarPorChatbotId(
    @Query('reservaChatbotId') reservaChatbotId: string,
    @GetUser('_id') userId: Types.ObjectId,
    @GetUser('agencia') agenciaId: Types.ObjectId,
    @GetUser() user: User,
  ) {
    if (!reservaChatbotId) {
      throw new BadRequestException(
        'El parámetro reservaChatbotId es requerido',
      );
    }
    return this.reservasService.buscarPorChatbotId(
      reservaChatbotId,
      userId,
      agenciaId,
      user.role,
    );
  }

  @ApiOperation({
    summary: 'Buscar reservas por nombre del agente',
    description:
      'Busca reservas por nombre del agente. Usa page para paginación o all=true para obtener todas las reservas sin límite.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de reservas encontradas' })
  @Get('buscar/agente')
  @Auth()
  buscarPorNombreAgente(
    @Query('nombre') nombre: string,
    @Query('page') page = 1,
    @Query('all') all: string,
    @GetUser('_id') userId: Types.ObjectId,
    @GetUser('agencia') agenciaId: Types.ObjectId,
    @GetUser() user: User,
  ) {
    if (!nombre) {
      throw new BadRequestException('El parámetro nombre es requerido');
    }
    const getAll = all === 'true' || all === '1';
    return this.reservasService.buscarPorNombreAgente(
      nombre,
      userId,
      agenciaId,
      user.role,
      page,
      getAll,
    );
  }

  @ApiOperation({
    summary: 'Buscar reservas por nombre de agencia',
    description:
      'Busca reservas por nombre de agencia. Usa page para paginación o all=true para obtener todas las reservas sin límite.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de reservas encontradas' })
  @Get('buscar/agencia')
  @Auth()
  buscarPorNombreAgencia(
    @Query('nombre') nombre: string,
    @Query('page') page = 1,
    @Query('all') all: string,
    @GetUser('_id') userId: Types.ObjectId,
    @GetUser('agencia') agenciaId: Types.ObjectId,
    @GetUser() user: User,
  ) {
    if (!nombre) {
      throw new BadRequestException('El parámetro nombre es requerido');
    }
    const getAll = all === 'true' || all === '1';
    return this.reservasService.buscarPorNombreAgencia(
      nombre,
      userId,
      agenciaId,
      user.role,
      page,
      getAll,
    );
  }

  @ApiOperation({
    summary: 'Buscar reservas por nombre del huésped',
    description:
      'Busca reservas por nombre del huésped. Usa page para paginación o all=true para obtener todas las reservas sin límite.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de reservas encontradas' })
  @Get('buscar/huesped')
  @Auth()
  buscarPorNombreHuesped(
    @Query('nombre') nombre: string,
    @Query('page') page = 1,
    @Query('all') all: string,
    @GetUser('_id') userId: Types.ObjectId,
    @GetUser('agencia') agenciaId: Types.ObjectId,
    @GetUser() user: User,
  ) {
    if (!nombre) {
      throw new BadRequestException('El parámetro nombre es requerido');
    }
    const getAll = all === 'true' || all === '1';
    return this.reservasService.buscarPorNombreHuesped(
      nombre,
      userId,
      agenciaId,
      user.role,
      page,
      getAll,
    );
  }

  @ApiOperation({
    summary: 'Buscar reservas por estado',
    description:
      'Busca reservas por estado. Usa page para paginación o all=true para obtener todas las reservas sin límite.',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de reservas encontradas' })
  @Get('buscar/estado')
  @Auth()
  buscarPorEstado(
    @Query('status') status: string,
    @Query('page') page = 1,
    @Query('all') all: string,
    @GetUser('_id') userId: Types.ObjectId,
    @GetUser('agencia') agenciaId: Types.ObjectId,
    @GetUser() user: User,
  ) {
    if (!status) {
      throw new BadRequestException('El parámetro status es requerido');
    }
    const statusNumber = parseInt(status, 10);
    if (isNaN(statusNumber) || statusNumber < 0 || statusNumber > 6) {
      throw new BadRequestException(
        'El status debe ser un número entre 0 y 6 (0: espera, 1: proceso, 2: rejected, 3: total, 4: cancelado, 5: mitad, 6: reserva abonada)',
      );
    }
    const getAll = all === 'true' || all === '1';
    return this.reservasService.buscarPorEstado(
      statusNumber as ValidPaymentStatus,
      userId,
      agenciaId,
      user.role,
      page,
      getAll,
    );
  }

  // #region Administracion
  @ApiOperation({
    summary: 'Obtener todas las reservas (solo superAdmin)',
    description:
      'Obtiene todas las reservas del sistema. Usa page para paginación o all=true para obtener todas las reservas sin límite. Opcionalmente filtra por hotel, nombre de agencia (solo superAdmin) o por fecha (fechaDesde y fechaHasta en formato YYYY-MM-DD).',
  })
  @ApiBearerAuth('JWT-auth')
  @Get()
  @Auth(ValidRoles.superAdmin)
  getAllReservas(
    @Query('page') page = 1,
    @Query('all') all: string,
    @Query('hotel') hotel?: string,
    @Query('nombreAgencia') nombreAgencia?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    const getAll = all === 'true' || all === '1';

    // Validar formato de fechas si se proporcionan
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (fechaDesde && !fechaRegex.test(fechaDesde)) {
      throw new BadRequestException('fechaDesde debe tener formato YYYY-MM-DD');
    }
    if (fechaHasta && !fechaRegex.test(fechaHasta)) {
      throw new BadRequestException('fechaHasta debe tener formato YYYY-MM-DD');
    }

    return this.reservasService.getAllReservas(
      page,
      getAll,
      hotel,
      nombreAgencia,
      fechaDesde,
      fechaHasta,
    );
  }

  @Delete('cancelar-reserva-admin/:reservaId')
  @Auth(ValidRoles.superAdmin)
  cancelarReservaAdmin(
    @Param('reservaId', ParseMongoIdPipe) reservaId: Types.ObjectId,
  ) {
    return this.reservasService.cancelarReservaAdmin(reservaId);
  }

  @Put('status/:reservaId')
  @Auth(ValidRoles.superAdmin)
  actualizarStatusReservaManual(
    @Param('reservaId', ParseMongoIdPipe) reservaId: Types.ObjectId,
    @Body(new ValidationPipe({ transform: true }))
    updateReservaStatusDto: UpdateReservaStatusDto,
    /** Si true o 1, no bloquea por fecha de check-in (solo superAdmin). */
    @Query('saltarValidacionCheckin') saltarValidacionCheckin?: string,
    /** Si true o 1, permite cancelar aunque exista pago de primera mitad pendiente de saldo (solo superAdmin). */
    @Query('forzarCancelacionConPagoMitad')
    forzarCancelacionConPagoMitad?: string,
  ) {
    const saltar =
      saltarValidacionCheckin === 'true' || saltarValidacionCheckin === '1';
    const forzarCancelMitad =
      forzarCancelacionConPagoMitad === 'true' ||
      forzarCancelacionConPagoMitad === '1';
    return this.reservasService.actualizarStatusReservaManual(
      reservaId,
      updateReservaStatusDto.status,
      saltar,
      forzarCancelMitad,
    );
  }

  @Post('comprobante-enviado/:reservaId')
  @Auth()
  @ApiOperation({
    summary: 'Registrar comprobante de pago enviado a Bitrix',
    description:
      'Deja la reserva en estado "En proceso" y guarda la referencia a la negociación creada en Bitrix. El archivo del comprobante no pasa por esta API: se sube desde el motor directamente a Bitrix.',
  })
  @ApiResponse({ status: 201, description: 'Comprobante registrado' })
  @ApiResponse({ status: 403, description: 'La reserva no es de tu agencia' })
  marcarComprobanteEnviado(
    @Param('reservaId', ParseMongoIdPipe) reservaId: Types.ObjectId,
    @Body(new ValidationPipe({ transform: true }))
    comprobanteEnviadoDto: ComprobanteEnviadoDto,
    @GetUser() user: User,
  ) {
    return this.reservasService.marcarComprobanteEnviado(
      reservaId,
      comprobanteEnviadoDto,
      user,
    );
  }

  @Put('fechas-pago/:reservaId')
  @Auth(ValidRoles.admin, ValidRoles.superAdmin)
  actualizarFechasPagoReserva(
    @Param('reservaId', ParseMongoIdPipe) reservaId: Types.ObjectId,
    @Body(new ValidationPipe({ transform: true }))
    updateFechasPagoDto: UpdateFechasPagoDto,
    @GetUser() user: User,
  ) {
    return this.reservasService.actualizarFechasPagoReserva(
      reservaId,
      updateFechasPagoDto,
      user,
    );
  }

  @Put('abono/:reservaChatbotId')
  @Auth(ValidRoles.superAdmin)
  @ApiOperation({
    summary: 'Actualizar abono de reserva (solo superAdmin)',
    description:
      'Registra el monto abonado por fuera de la plataforma. Usado para reactivaciones y cálculo de saldos pendientes.',
  })
  @ApiParam({
    name: 'reservaChatbotId',
    description: 'ID del chatbot de la reserva (ej: CB88D9393D)',
    example: 'CB88D9393D',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Abono actualizado' })
  @ApiResponse({ status: 403, description: 'Solo superAdmin' })
  @ApiResponse({ status: 404, description: 'Reserva no encontrada' })
  actualizarAbonoReserva(
    @Param('reservaChatbotId') reservaChatbotId: string,
    @Body(new ValidationPipe({ transform: true }))
    actualizarAbonoDto: ActualizarAbonoDto,
  ) {
    return this.reservasService.actualizarAbonoReserva(
      reservaChatbotId,
      actualizarAbonoDto,
    );
  }

  // #region MyTool Booking

  @Post('mytool/cancelar')
  @ApiTags('reservas', 'my-tool')
  @Auth()
  @ApiOperation({
    summary:
      'Cancelar en MyTool (cancelBookAvail). Si reservaProvider es autocore, cancela en Autocore. Busca por localizador = reservaChatbotId',
  })
  @ApiBody({ type: CancelReservaMyToolDto })
  @ApiBearerAuth('JWT-auth')
  cancelReservaMyTool(
    @Body() dto: CancelReservaMyToolDto,
    @GetUser() user: User,
  ) {
    return this.reservasService.cancelarReservaMyTool(dto, user);
  }

  @Get('mytool/:hotelSlug/mappings')
  @ApiTags('reservas', 'my-tool')
  @Auth()
  @ApiOperation({ summary: 'Obtener mappings de un hotel desde MyTool' })
  @ApiParam({
    name: 'hotelSlug',
    description: 'Identificador slug del hotel configurado para MyTool',
  })
  @ApiBearerAuth('JWT-auth')
  getMyToolMappings(@Param('hotelSlug', ParseHotelSlugPipe) hotelSlug: string) {
    return this.reservasService.getMyToolMappings(hotelSlug);
  }

  @Get('mytool/:hotelSlug/buscar')
  @ApiTags('reservas', 'my-tool')
  @Auth()
  @ApiOperation({
    summary: 'Buscar reserva en MyTool por localizador y nombre',
  })
  @ApiParam({
    name: 'hotelSlug',
    description: 'Identificador slug del hotel configurado para MyTool',
  })
  @ApiBearerAuth('JWT-auth')
  searchReservaMyTool(
    @Param('hotelSlug', ParseHotelSlugPipe) hotelSlug: string,
    @Query() dto: SearchReservaMyToolDto,
  ): Promise<MyToolBookingResponse> {
    return this.reservasService.searchReservaMyTool(
      hotelSlug,
      dto.localizador,
      dto.nombre,
    );
  }

  @Post('mytool/:hotelSlug')
  @ApiTags('reservas', 'my-tool')
  @Auth()
  @ApiOperation({
    summary: 'Crear reserva vía MyTool (fallback Autocore)',
    description:
      'Body alineado con MyTool. `bookData.localizador` lo genera el servidor (formato `reservaChatbotId`). ' +
      'En cada elemento de `rooms[]`, los campos opcionales `nombreHabitacion` y `room_id` se guardan en `reservation.roomsData` ' +
      'y no se reenvían al API externo de MyTool. ' +
      '`bookData.acuerdos` se envía a My Tool; `notes` (opcional) es solo interno y se persiste en `reservation.notes` (no va al API My Tool). ' +
      '`infoTransporte` e `infoToures` opcionales: solo MongoDB, no My Tool. `mascotasNumber` (0 = sin mascotas, >0 con mascotas; deriva `reserva.mascotas`) solo BD.',
  })
  @ApiParam({
    name: 'hotelSlug',
    description: 'Identificador slug del hotel configurado para MyTool',
  })
  @ApiBody({ type: CreateReservaMyToolDto })
  @ApiResponse({ status: 201, description: 'Reserva creada exitosamente' })
  @ApiBearerAuth('JWT-auth')
  createReservaMyTool(
    @Param('hotelSlug', ParseHotelSlugPipe) hotelSlug: string,
    @Body() dto: CreateReservaMyToolDto,
    @GetUser() user: User,
  ) {
    return this.reservasService.createReservaMyTool(
      dto,
      hotelSlug,
      user._id.toString(),
    );
  }

  // #endregion MyTool Booking
}
