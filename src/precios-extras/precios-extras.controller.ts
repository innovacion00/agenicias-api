import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidRoles } from 'src/auth/interfaces';
import { ParseMongoIdPipe } from 'src/common/pipes';
import { Auth } from 'src/auth/decorators';
import {
  CreatePrecioExtraDto,
  UpdatePrecioExtraDto,
} from './dto';
import { PreciosExtrasService } from './precios-extras.service';

@ApiTags('precios-extras')
@ApiBearerAuth('JWT-auth')
@Auth(ValidRoles.superAdmin)
@Controller('precios-extras')
export class PreciosExtrasController {
  constructor(private readonly service: PreciosExtrasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear precio extra' })
  crear(@Body() dto: CreatePrecioExtraDto) {
    return this.service.crear(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar catálogo completo (incluye inactivos)',
  })
  listar() {
    return this.service.listarAdmin();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar precio extra' })
  actualizar(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: UpdatePrecioExtraDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar precio extra' })
  eliminar(@Param('id', ParseMongoIdPipe) id: string) {
    return this.service.eliminar(id);
  }
}