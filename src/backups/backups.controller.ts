import { Controller, Post, Logger, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BackupsService } from './backups.service';
import { ValidRoles } from '../auth/interfaces';
import { UserRoleGuard } from '../auth/guards/user-role.guard';
import { RoleProtected } from '../auth/decorators/auth/role-protected.decorator';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('backups')
@Controller('backups')
export class BackupsController {
  private readonly logger = new Logger(BackupsController.name);

  constructor(private readonly backupsService: BackupsService) {}

  @Post('trigger')
  @ApiOperation({
    summary: 'Ejecutar backup manualmente',
    description:
      'Ejecuta de forma inmediata el proceso completo de backup: extracción de MongoDB, compresión a ZIP, subida a Google Drive y notificación por email.',
  })
  @RoleProtected(ValidRoles.superAdmin)
  @UseGuards(AuthGuard('jwt'), UserRoleGuard)
  async triggerBackup() {
    this.logger.log('Backup manual disparado desde el controlador...');

    try {
      await this.backupsService.ejecutarBackup();

      return {
        success: true,
        message: 'Backup completado exitosamente',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error en backup manual: ${msg}`);

      return {
        success: false,
        message: 'Error durante el backup',
        error: msg,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
