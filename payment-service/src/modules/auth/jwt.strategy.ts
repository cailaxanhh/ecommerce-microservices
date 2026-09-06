import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthSubject } from './policy/policy.service.js';

export interface JwtPayload {
  sub: string;
  email?: string;
  role: 'customer' | 'staff' | 'admin' | 'service';
  region?: string;
  isServiceAccount?: boolean;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('app.jwt.secret')!,
    });
  }

  validate(payload: JwtPayload): AuthSubject {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      region: payload.region,
      isServiceAccount: payload.isServiceAccount || false,
    };
  }
}
