import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { User } from '../domain/entities/user.entity.js';
import { UserApplicationService } from '../user/user.application.service.js';

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
}

const DEFAULT_ROLE = 'USER';

@Injectable()
export class AuthApplicationService {
  constructor(
    private readonly userService: UserApplicationService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    password: string;
  }): Promise<AuthTokenPair> {
    const user = await this.userService.create(data);
    return this.issueTokenPair(user);
  }

  async login(email: string, password: string): Promise<AuthTokenPair> {
    const user = await this.userService.findByEmail(email).catch(() => null);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokenPair(user);
  }

  async renewToken(refreshToken: string): Promise<AuthTokenPair> {
    const user = await this.resolveRefreshToken(refreshToken);
    return this.issueTokenPair(user);
  }

  private async resolveRefreshToken(refreshToken: string): Promise<User> {
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.signingSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userService.findById(payload.sub as string);
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }
    return user;
  }

  private async issueTokenPair(user: User): Promise<AuthTokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: user.id,
          role: DEFAULT_ROLE,
          type: 'access',
        },
        {
          secret: this.signingSecret,
          expiresIn: this.accessExpiresIn,
        },
      ),
      this.jwtService.signAsync(
        {
          sub: user.id,
          type: 'refresh',
        },
        {
          secret: this.signingSecret,
          expiresIn: this.refreshExpiresIn,
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: parseDurationToSeconds(this.accessExpiresIn),
      user,
    };
  }

  private get signingSecret(): string {
    return (
      this.configService.get<string>('JWT_SECRET') ??
      this.configService.getOrThrow<string>('INTERNAL_JWT_SECRET')
    );
  }

  private get accessExpiresIn(): StringValue {
    return this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as StringValue;
  }

  private get refreshExpiresIn(): StringValue {
    return this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as StringValue;
  }
}

function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(duration.trim());
  if (!match) {
    return 0;
  }
  const value = Number(match[1]);
  switch ((match[2] ?? 's').toLowerCase()) {
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      return value;
  }
}