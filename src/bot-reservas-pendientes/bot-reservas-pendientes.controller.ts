import { Controller, Post, Logger, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BotReservasPendientesService } from './bot-reservas-pendientes.service';
import { ValidRoles } from '../auth/interfaces';
import { UserRoleGuard } from '../auth/guards/user-role.guard';
import { RoleProtected } from '../auth/decorators/auth/role-protected.decorator';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('bot-reservas-pendientes')
@Controller('bot-reservas-pendientes')
export class BotReservasPendientesController {
  private readonly logger = new Logger(BotReservasPendientesController.name);

  constructor(
    private readonly botReservasPendientesService: BotReservasPendientesService,
  ) {}

  /**
   * Endpoint para ejecutar el bot manualmente
   * Solo accesible para super-admin
   */
  @Post('ejecutar-manualmente')
  @ApiOperation({
    summary: 'Ejecutar bot de reservas pendientes manualmente',
    description: 'Ejecuta de forma inmediata el proceso que detecta reservas próximas a vencer y envía el reporte.',
  })
  @RoleProtected(ValidRoles.superAdmin)
  @UseGuards(AuthGuard('jwt'), UserRoleGuard)
  async ejecutarBotManualmente() {
    this.logger.log(' Ejecutando bot manualmente desde el controlador...');
    
    try {
      await this.botReservasPendientesService.ejecutarManualmente();
      
      return {
        success: true,
        message: 'Bot ejecutado exitosamente',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error al ejecutar el bot manualmente:', error);
      
      return {
        success: false,
        message: 'Error al ejecutar el bot',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Endpoint para verificar el estado del bot
   * Solo accesible para super-admin
   */
  @Post('estado')
  @ApiOperation({
    summary: 'Consultar estado del bot',
    description: 'Devuelve estado operativo del bot de reservas pendientes y metadatos básicos de ejecución.',
  })
  @RoleProtected(ValidRoles.superAdmin)
  @UseGuards(AuthGuard('jwt'), UserRoleGuard)
  async obtenerEstadoBot() {
    return {
      status: 'active',
      message: 'Bot de reservas pendientes está activo y funcionando',
      nextExecution: 'Cada día a las 8:00 AM',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Endpoint de diagnóstico para revisar las reservas en la base de datos
   * Solo accesible para super-admin
   */
  @Post('diagnostico')
  @ApiOperation({
    summary: 'Ejecutar diagnóstico del bot',
    description: 'Genera diagnóstico de reservas y criterios del bot para soporte técnico y validación funcional.',
  })
  @RoleProtected(ValidRoles.superAdmin)
  @UseGuards(AuthGuard('jwt'), UserRoleGuard)
  async diagnosticoReservas() {
    this.logger.log(' Ejecutando diagnóstico de reservas...');
    
    try {
      const diagnostico = await this.botReservasPendientesService.diagnosticoReservas();
      
      return {
        success: true,
        message: 'Diagnóstico ejecutado exitosamente',
        diagnostico,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(' Error al ejecutar diagnóstico:', error);
      
      return {
        success: false,
        message: 'Error al ejecutar diagnóstico',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
