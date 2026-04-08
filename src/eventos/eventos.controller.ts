import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EventosService } from './eventos.service';
import { CreateReservaEventoDto } from './dto';
import { Auth, GetUser } from 'src/auth/decorators';
import { Types } from 'mongoose';
import { ValidRoles } from 'src/auth/interfaces';
import { ParseCreateEventoPipe } from './pipes';

@ApiTags('eventos')
@Controller('eventos')
export class EventosController {
  constructor(private readonly eventosService: EventosService) {}

  @Post('create')
  @ApiOperation({
    summary: 'Crear reserva de evento',
    description: 'Registra una nueva reserva de evento asociada al usuario autenticado.',
  })
  @Auth()
  createEventoReserva(
    @Body(new ParseCreateEventoPipe())
    createEventoReservaDto: CreateReservaEventoDto,
    @GetUser('_id') _id: Types.ObjectId,
  ) {
    return this.eventosService.createEventoReserva(createEventoReservaDto, _id);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar eventos',
    description: 'Retorna el listado de eventos disponibles para roles administrativos autorizados.',
  })
  @Auth(ValidRoles.eventosSuperAdmin, ValidRoles.superAdmin)
  getEventos() {
    return this.eventosService.getEventos();
  }
}
