import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthApplicationService } from './auth.application.service.js';
import { UserApplicationService } from '../user/user.application.service.js';
import { User } from '../domain/entities/user.entity.js';

describe('AuthApplicationService', () => {
  let service: AuthApplicationService;
  let userService: {
    create: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let jwtService: {
    signAsync: ReturnType<typeof vi.fn>;
    verifyAsync: ReturnType<typeof vi.fn>;
  };
  let configService: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.restoreAllMocks();
    userService = {
      create: vi.fn(),
      findByEmail: vi.fn(),
      findById: vi.fn(),
    };
    jwtService = {
      signAsync: vi.fn().mockResolvedValue('signed-token'),
      verifyAsync: vi.fn(),
    };
    configService = {
      get: vi.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          JWT_SECRET: 'test-secret',
          INTERNAL_JWT_SECRET: 'internal-secret',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };
        return values[key] ?? fallback;
      }),
    };
    service = new AuthApplicationService(
      userService as unknown as UserApplicationService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  const user = {
    id: 'user-1',
    email: 'jane.doe@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    isActive: true,
    passwordHash: '$2b$10$hash',
  } as User;

  const registerInput = {
    email: 'jane.doe@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '0123456789',
    password: 'password123',
  };

  describe('register', () => {
    it('creates the user and issues an access + refresh token pair', async () => {
      userService.create.mockResolvedValue(user);

      const result = await service.register(registerInput);

      expect(userService.create).toHaveBeenCalledWith(registerInput);
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(900);
      expect(result.user).toBe(user);
    });
  });

  describe('login', () => {
    it('issues a token pair when credentials are valid', async () => {
      userService.findByEmail.mockResolvedValue(user);
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const result = await service.login(user.email, 'password123');

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(result.user).toBe(user);
    });

    it('throws UnauthorizedException when the email is unknown', async () => {
      userService.findByEmail.mockRejectedValue(new Error('not found'));

      await expect(service.login('nobody@example.com', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the password is wrong', async () => {
      userService.findByEmail.mockResolvedValue(user);
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(service.login(user.email, 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the account has no password', async () => {
      userService.findByEmail.mockResolvedValue({ ...user, passwordHash: null } as User);

      await expect(service.login(user.email, 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the account is deactivated', async () => {
      userService.findByEmail.mockResolvedValue({ ...user, isActive: false } as User);

      await expect(service.login(user.email, 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('renewToken', () => {
    it('issues a fresh token pair for a valid refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: user.id, type: 'refresh' });
      userService.findById.mockResolvedValue(user);

      const result = await service.renewToken('valid-refresh-token');

      expect(userService.findById).toHaveBeenCalledWith(user.id);
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(result.user).toBe(user);
    });

    it('throws UnauthorizedException for an invalid refresh token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('bad token'));

      await expect(service.renewToken('bad-token')).rejects.toThrow(UnauthorizedException);
      expect(userService.findById).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the token is not a refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: user.id, type: 'access' });

      await expect(service.renewToken('access-token')).rejects.toThrow(UnauthorizedException);
      expect(userService.findById).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the user is deactivated', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: user.id, type: 'refresh' });
      userService.findById.mockResolvedValue({ ...user, isActive: false } as User);

      await expect(service.renewToken('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});