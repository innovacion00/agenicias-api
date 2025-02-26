import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiKeyAuth } from './api-key-auth.decorator';
import { ApiKeyGuard } from 'src/auth/guards';

export function ApiKeyProtected() {
  return applyDecorators(ApiKeyAuth(), UseGuards(ApiKeyGuard));
}
