import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(
    _err: Error | null,
    user: TUser | false | null,
  ): TUser | null {
    return user || null;
  }
}
