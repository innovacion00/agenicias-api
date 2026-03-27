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
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
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
  UpdateReservaStatusDto,
} from './dto';
import { Auth, GetUser } from 'src/auth/decorators';
import { User } from 'src/auth/entities';
import { ParseMongoIdPipe } from 'src/common/pipes';
import { ParseCheckinCheckoutPipe, ParseHotelIdPipe } from './pipes';
import { ValidRoles } from 'src/auth/interfaces';
import { ValidPaymentStatus } from './interfaces';

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

  @ApiOperation({ summary: 'Obtener reservas del usuario autenticado' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de reservas del usuario' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @Get('/reservas-by-user')
  @Auth()
  getReservasByUser(
    @GetUser('_id') _id: Types.ObjectId,
    @Query('page') page: number = 1,
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
    @Query('page') page: number = 1,
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

  // #region Búsquedas
  @ApiOperation({ 
    summary: 'Buscar reservas por reservaChatbotId',
    description: 'Busca reservas por ID del chatbot. Primero intenta búsqueda exacta, luego parcial. No requiere paginación ya que retorna todos los resultados encontrados (máximo 100).'
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
      throw new BadRequestException('El parámetro reservaChatbotId es requerido');
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
    description: 'Busca reservas por nombre del agente. Usa page para paginación o all=true para obtener todas las reservas sin límite.'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de reservas encontradas' })
  @Get('buscar/agente')
  @Auth()
  buscarPorNombreAgente(
    @Query('nombre') nombre: string,
    @Query('page') page: number = 1,
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
    description: 'Busca reservas por nombre de agencia. Usa page para paginación o all=true para obtener todas las reservas sin límite.'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de reservas encontradas' })
  @Get('buscar/agencia')
  @Auth()
  buscarPorNombreAgencia(
    @Query('nombre') nombre: string,
    @Query('page') page: number = 1,
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
    description: 'Busca reservas por nombre del huésped. Usa page para paginación o all=true para obtener todas las reservas sin límite.'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de reservas encontradas' })
  @Get('buscar/huesped')
  @Auth()
  buscarPorNombreHuesped(
    @Query('nombre') nombre: string,
    @Query('page') page: number = 1,
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
    description: 'Busca reservas por estado. Usa page para paginación o all=true para obtener todas las reservas sin límite.'
  })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'Lista de reservas encontradas' })
  @Get('buscar/estado')
  @Auth()
  buscarPorEstado(
    @Query('status') status: string,
    @Query('page') page: number = 1,
    @Query('all') all: string,
    @GetUser('_id') userId: Types.ObjectId,
    @GetUser('agencia') agenciaId: Types.ObjectId,
    @GetUser() user: User,
  ) {
    if (!status) {
      throw new BadRequestException('El parámetro status es requerido');
    }
    const statusNumber = parseInt(status, 10);
    if (isNaN(statusNumber) || statusNumber < 0 || statusNumber > 5) {
      throw new BadRequestException(
        'El status debe ser un número entre 0 y 5 (0: espera, 1: proceso, 2: rejected, 3: total, 4: cancelado, 5: mitad)',
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
    description: 'Obtiene todas las reservas del sistema. Usa page para paginación o all=true para obtener todas las reservas sin límite. Opcionalmente filtra por hotel, nombre de agencia (solo superAdmin) o por fecha (fechaDesde y fechaHasta en formato YYYY-MM-DD).'
  })
  @ApiBearerAuth('JWT-auth')
  @Get()
  @Auth(ValidRoles.superAdmin)
  getAllReservas(
    @Query('page') page: number = 1,
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
    
    return this.reservasService.getAllReservas(page, getAll, hotel, nombreAgencia, fechaDesde, fechaHasta);
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
  ) {
    return this.reservasService.actualizarStatusReservaManual(
      reservaId,
      updateReservaStatusDto.status,
    );
  }

  // @Post('prueba')
  // prueba() {
  //   return this.reservasService.prueba();
  // }
}
