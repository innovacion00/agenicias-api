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
import { Types } from 'mongoose';
import { ReservasService } from './reservas.service';
import {
  ChangeStatusDto,
  DisponibilidadAutocoreDto,
  GenerateLinkDto,
  CreateReservaDto,
  CancelReservaDto,
  UpdateReservaDto,
} from './dto';
import { Auth, GetUser } from 'src/auth/decorators';
import { User } from 'src/auth/entities';
import { ParseMongoIdPipe } from 'src/common/pipes';
import { ValidateCheckinCheckout } from './pipes';
import { ValidRoles } from 'src/auth/interfaces';

@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Post('reservar')
  @Auth()
  create(
    @Body(new ValidateCheckinCheckout()) createReservaDto: CreateReservaDto,
    @Query('hotelId') hotelId: string,
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
  cambiarEstadoPagoReserva(@Body() changeStatusDto: any) {
    return this.reservasService.cambiarEstadoPagoReserva(changeStatusDto);
  }

  @Get('/reservas-by-user')
  @Auth()
  getReservasByUser(@GetUser('_id') _id: Types.ObjectId) {
    return this.reservasService.getReservasByUser(_id);
  }

  @Post('generate-link')
  @Auth()
  generateLinkPago(
    @Body() generateLinkDto: GenerateLinkDto,
    @GetUser('agencia') agencia: Types.ObjectId,
  ) {
    return this.reservasService.generarLinkPago(generateLinkDto, agencia);
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

  // #region Administracion
  @Get()
  @Auth(ValidRoles.superAdmin)
  getAllReservas() {
    return this.reservasService.getAllReservas();
  }
}
