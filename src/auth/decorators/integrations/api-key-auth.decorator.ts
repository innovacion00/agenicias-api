import { SetMetadata } from '@nestjs/common';

export const API_KEY_METADATA = 'api_key_auth';

export const ApiKeyAuth = () => {
  return SetMetadata(API_KEY_METADATA, true);
};
