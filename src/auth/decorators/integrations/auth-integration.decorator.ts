import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiKeyAuth } from './api-key-auth.decorator';
import { ApiKeyGuard } from 'src/auth/guards';
import { ValidIntegrationsRoles } from 'src/auth/interfaces';
import { RoleIntegrations } from './roles-integrations.decorator';

export function ApiKeyProtected(...roles: ValidIntegrationsRoles[]) {
  return applyDecorators(
    RoleIntegrations(...roles),
    ApiKeyAuth(),
    UseGuards(ApiKeyGuard),
  );
}
