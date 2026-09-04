import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface InternalJwtPayload {
  sub: string;
  roles?: string[];
  [key: string]: unknown;
}

@Injectable()
export class InternalJwtStrategy extends PassportStrategy(Strategy, 'internal-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('INTERNAL_JWT_SECRET')!,
    });
  }

  validate(payload: InternalJwtPayload) {
    return {
      userId: payload.sub,
      roles: payload.roles ?? [],
    };
  }
}
