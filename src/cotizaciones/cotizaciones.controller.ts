import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('cotizaciones')
@Controller('cotizaciones')
@Auth()
export class CotizacionesController {
  constructor(private readonly cotizacionesService: CotizacionesService) {}

  @Post()
  @Auth()
  @ApiOperation({
    summary: 'Crear cotización',
    description: 'Registra una nueva cotización asociada al usuario y su agencia.',
  })
  create(@Body() createCotizacionDto: CreateCotizacionDto, @GetUser() user: User) {
    return this.cotizacionesService.create(
      createCotizacionDto,
      (user._id as Types.ObjectId).toString(),
      user.agencia?.toString() || '',
    );
  }

  @Get('debug-user')
  @Auth()
  @ApiOperation({
    summary: 'Depurar usuario autenticado',
    description: 'Retorna datos del usuario autenticado para diagnóstico de permisos y contexto.',
  })
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
  @ApiOperation({
    summary: 'Probar validación de DTO de cotización',
    description: 'Endpoint de soporte para validar estructura y transformación del DTO de cotizaciones.',
  })
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
  @ApiOperation({
    summary: 'Crear cotización desde disponibilidad',
    description: 'Genera una cotización usando información proveniente del flujo de disponibilidad.',
  })
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
  @ApiOperation({
    summary: 'Listar cotizaciones',
    description: 'Lista cotizaciones paginadas; super admin ve todas y demás usuarios ven las de su agencia.',
  })
  findAll(
    @GetUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const isSuperAdmin = user.role?.includes(ValidRoles.superAdmin);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 25;

    if (isSuperAdmin) {
      return this.cotizacionesService.findAll(pageNum, limitNum);
    }

    return this.cotizacionesService.findAllByAgencia(
      user.agencia?.toString() || '',
      pageNum,
      limitNum,
    );
  }

  @Get('estadisticas')
  @Auth()
  @ApiOperation({
    summary: 'Obtener estadísticas de cotizaciones',
    description: 'Devuelve métricas agregadas de cotizaciones para la agencia del usuario.',
  })
  getEstadisticas(@GetUser() user: User) {
    return this.cotizacionesService.getEstadisticas(
      user.agencia?.toString() || '',
    );
  }

  @Get('test-disponibilidad-directa')
  @Auth()
  @ApiOperation({
    summary: 'Probar disponibilidad directa',
    description: 'Endpoint de soporte para validar integración de disponibilidad usada por cotizaciones.',
  })
  testDisponibilidad(@GetUser() user: User) {
    return this.cotizacionesService.testDisponibilidadDirecta(
      user.agencia?.toString() || '',
    );
  }

  @Get(':id')
  @Auth()
  @ApiOperation({
    summary: 'Obtener cotización por ID',
    description: 'Consulta una cotización específica por su identificador.',
  })
  findOne(@Param('id') id: string) {
    return this.cotizacionesService.findOne(id);
  }

  @Get('token/:tokenAcceso')
  @ApiOperation({
    summary: 'Obtener cotización por token',
    description: 'Consulta una cotización usando su token de acceso compartible.',
  })
  findOneByToken(@Param('tokenAcceso') tokenAcceso: string) {
    return this.cotizacionesService.findByToken(tokenAcceso);
  }

  @Post('responder/:tokenAcceso')
  @Auth()
  @ApiOperation({
    summary: 'Responder cotización',
    description: 'Permite registrar la respuesta comercial de una cotización usando su token.',
  })
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
  @ApiOperation({
    summary: 'Generar PDF de cotización',
    description: 'Genera y retorna el documento PDF de una cotización.',
  })
  generatePdf(@Body() generatePdfDto: GeneratePdfDto) {
    return this.cotizacionesService.generatePdf(generatePdfDto.cotizacionId);
  }

  @Post('convertir-reserva/:id')
  @Auth()
  @ApiOperation({
    summary: 'Convertir cotización en reserva',
    description: 'Transforma una cotización aprobada en una reserva dentro del sistema.',
  })
  convertirAReserva(@Param('id') id: string, @GetUser() user: User) {
    return this.cotizacionesService.convertirAReserva(id, user);
  }

  @Patch(':id')
  @Auth()
  @ApiOperation({
    summary: 'Actualizar cotización',
    description: 'Modifica una cotización existente por su identificador.',
  })
  update(@Param('id') id: string, @Body() updateCotizacionDto: UpdateCotizacionDto) {
    return this.cotizacionesService.update(id, updateCotizacionDto);
  }

  @Delete(':id')
  @Auth()
  @ApiOperation({
    summary: 'Eliminar cotización',
    description: 'Elimina una cotización por su identificador.',
  })
  remove(@Param('id') id: string) {
    return this.cotizacionesService.remove(id);
  }
}
