import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as fs from 'fs';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwtSecret = configService.get('JWT_SECRET');
    const jwtPublicKeyPath = configService.get('JWT_PUBLIC_KEY');

    let secretOrKey = '';

    if (jwtPublicKeyPath && jwtPublicKeyPath.lenght > 0) {
      try {
        secretOrKey = fs.readFileSync(jwtPublicKeyPath, 'utf-8');
      } catch {
        throw new Error(`Cannot read JWT public key at path ${jwtPublicKeyPath}`);
      }
    } else {
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is required when JWT_PUBLIC_KEY is not set');
      }
      secretOrKey = jwtSecret;
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey,
    });
  }

  validate(payload: Record<string, unknown>): { userId: string; role: string } {
    if (!payload?.sub || !payload?.role) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return { userId: payload.sub as string, role: payload.role as string };
  }
}
