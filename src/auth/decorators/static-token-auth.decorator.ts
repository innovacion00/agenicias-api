import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { StaticTokenGuard } from '../guards/static-token.guard';
import { ApiSecurity } from '@nestjs/swagger';

export const STATIC_TOKEN_METADATA = 'static_token_auth';

export const StaticTokenAuth = () => {
  return applyDecorators(
    SetMetadata(STATIC_TOKEN_METADATA, true),
    UseGuards(StaticTokenGuard),
    ApiSecurity('x-booking-token'),
  );
};
