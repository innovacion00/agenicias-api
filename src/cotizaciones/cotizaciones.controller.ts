import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CotizacionesService } from './cotizaciones.service';
import {
  CreateCotizacionDto,
  ResponderCotizacionDto,
  GeneratePdfDto,
  UpdateCotizacionDto,
} from './dto';
import { Auth, GetUser } from '../auth/decorators';
import { User } from '../auth/entities';
import { ValidRoles } from '../auth/interfaces';
import { Types } from 'mongoose';

@Controller('cotizaciones')
@Auth()
export class CotizacionesController {
  constructor(private readonly cotizacionesService: CotizacionesService) {}

  @Post()
  @Auth()
  create(@Body() createCotizacionDto: CreateCotizacionDto, @GetUser() user: User) {
    return this.cotizacionesService.create(
      createCotizacionDto,
      (user._id as Types.ObjectId).toString(),
      user.agencia?.toString() || '',
    );
  }

  @Get('debug-user')
  @Auth()
  debugUser(@GetUser() user: User) {
    return {
      id: user._id,
      email: user.email,
      roles: user.role,
      agencia: user.agencia,
      fullName: user.fullName,
    };
  }

  @Post('test-validation')
  @Auth()
  testValidation(@Body() createCotizacionDto: CreateCotizacionDto) {
    return {
      message: 'DTO validado correctamente',
      receivedData: {
        total: createCotizacionDto.total,
        planAlimentario: createCotizacionDto.planAlimentario,
        fechaLimiteRespuesta: createCotizacionDto.fechaLimiteRespuesta,
        titularInfo: createCotizacionDto.titularInfo ? 'presente' : 'ausente',
        reservaInfo: createCotizacionDto.reservaInfo ? 'presente' : 'ausente',
      },
    };
  }

  @Post('from-disponibilidad')
  @Auth()
  createFromDisponibilidad(
    @Body() createCotizacionDto: CreateCotizacionDto,
    @GetUser() user: User,
  ) {
    return this.cotizacionesService.createFromDisponibilidad(
      createCotizacionDto,
      (user._id as Types.ObjectId).toString(),
      user.agencia?.toString() || '',
    );
  }

  @Get()
  @Auth()
  findAll(@GetUser() user: User) {
    const isSuperAdmin = user.role?.includes(ValidRoles.superAdmin);

    if (isSuperAdmin) {
      return this.cotizacionesService.findAll();
    }

    return this.cotizacionesService.findAllByAgencia(
      user.agencia?.toString() || '',
    );
  }

  @Get('estadisticas')
  @Auth()
  getEstadisticas(@GetUser() user: User) {
    return this.cotizacionesService.getEstadisticas(
      user.agencia?.toString() || '',
    );
  }

  @Get('test-disponibilidad-directa')
  @Auth()
  testDisponibilidad(@GetUser() user: User) {
    return this.cotizacionesService.testDisponibilidadDirecta(
      user.agencia?.toString() || '',
    );
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id') id: string) {
    return this.cotizacionesService.findOne(id);
  }

  @Get('token/:tokenAcceso')
  findOneByToken(@Param('tokenAcceso') tokenAcceso: string) {
    return this.cotizacionesService.findByToken(tokenAcceso);
  }

  @Post('responder/:tokenAcceso')
  @Auth()
  responderCotizacion(
    @Param('tokenAcceso') tokenAcceso: string,
    @Body() responderCotizacionDto: ResponderCotizacionDto,
  ) {
    return this.cotizacionesService.responderCotizacion(
      tokenAcceso,
      responderCotizacionDto,
    );
  }

  @Post('pdf')
  @Auth()
  generatePdf(@Body() generatePdfDto: GeneratePdfDto) {
    return this.cotizacionesService.generatePdf(generatePdfDto.cotizacionId);
  }

  @Post('convertir-reserva/:id')
  @Auth()
  convertirAReserva(@Param('id') id: string) {
    return this.cotizacionesService.convertirAReserva(id);
  }

  @Patch(':id')
  @Auth()
  update(@Param('id') id: string, @Body() updateCotizacionDto: UpdateCotizacionDto) {
    return this.cotizacionesService.update(id, updateCotizacionDto);
  }

  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string) {
    return this.cotizacionesService.remove(id);
  }
}
