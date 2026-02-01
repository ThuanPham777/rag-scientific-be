import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUserPayload } from '../../auth/jwt.strategy';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
