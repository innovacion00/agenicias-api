import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';

export const GetIntegration = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const integration = req.integration;

    if (!integration) {
      throw new InternalServerErrorException('Usuario no econtrado(request)');
    }

    return data ? integration[data] : integration;
  },
);
