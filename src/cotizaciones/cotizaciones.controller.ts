import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { CotizacionesService } from './cotizaciones.service';
import { CreateCotizacionDto, ResponderCotizacionDto, GeneratePdfDto, StoreLandingDto } from './dto';
import { Auth, GetUser } from 'src/auth/decorators';
import { User } from 'src/auth/entities';
import { ValidRoles } from 'src/auth/interfaces';

@Controller('cotizaciones')
@Auth()
export class CotizacionesController {
  constructor(private readonly cotizacionesService: CotizacionesService) {}

  @Post()
  @Auth(ValidRoles.user)
  create(@Body() createCotizacionDto: CreateCotizacionDto, @GetUser() user: User) {
    return this.cotizacionesService.create(
      createCotizacionDto,
      user._id.toString(),
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
      fullName: user.fullName
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
        cotizacionChatbotId: createCotizacionDto.cotizacionChatbotId,
        fechaLimiteRespuesta: createCotizacionDto.fechaLimiteRespuesta,
        asistentesCount: createCotizacionDto.asistentes?.length || 0,
        titularInfo: createCotizacionDto.titularInfo ? 'presente' : 'ausente',
        reservaInfo: createCotizacionDto.reservaInfo ? 'presente' : 'ausente'
      }
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
      user._id.toString(),
      user.agencia?.toString() || '',
    );
  }

  @Get()
  @Auth()
  findAll(@GetUser() user: User) {
    return this.cotizacionesService.findAllByAgencia(user.agencia?.toString() || '');
  }

  @Get('estadisticas')
  @Auth()
  getEstadisticas(@GetUser() user: User) {
    return this.cotizacionesService.getEstadisticas(user.agencia?.toString() || '');
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

  @Post('landing/:id')
  @Auth()
  generateLandingData(@Param('id') id: string) {
    return this.cotizacionesService.generateLandingData(id);
  }

  @Post('store-landing')
  @Auth()
  storeLanding(@Body() storeLandingDto: StoreLandingDto) {
    return this.cotizacionesService.storeLanding(storeLandingDto);
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
  update(@Param('id') id: string, @Body() updateCotizacionDto: any) {
    return this.cotizacionesService.update(id, updateCotizacionDto);
  }

  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string) {
    return this.cotizacionesService.remove(id);
  }
}
