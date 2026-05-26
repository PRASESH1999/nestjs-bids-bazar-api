import {
  BadRequestException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { body } = context
      .switchToHttp()
      .getRequest<{ body: Record<string, unknown> }>();
    const { email, password } = body;
    if (!email && !password) {
      throw new BadRequestException('Email and password are required');
    }
    if (!email) {
      throw new BadRequestException('Email is required');
    }
    if (!password) {
      throw new BadRequestException('Password is required');
    }
    return super.canActivate(context) as Promise<boolean>;
  }
}
