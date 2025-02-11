import { SetMetadata } from '@nestjs/common';
import { ValidIntegrationsRoles } from 'src/auth/interfaces';

export const META_INTEGRATIONS_ROLES = 'role';

export const RoleIntegrations = (...args: ValidIntegrationsRoles[]) => {
  return SetMetadata(META_INTEGRATIONS_ROLES, args);
};
