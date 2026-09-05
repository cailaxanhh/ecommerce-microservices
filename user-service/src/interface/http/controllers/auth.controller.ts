import { Body, Controller, Post } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AuthApplicationService, AuthTokenPair } from '../../../auth/auth.application.service.js';
import { LoginDto } from '../dto/login.dto.js';
import { RegisterDto } from '../dto/register.dto.js';
import { RenewTokenDto } from '../dto/renew-token.dto.js';
import { AuthResponseDto } from '../dto/auth-response.dto.js';
import { UserResponseDto } from '../dto/user-response.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthApplicationService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    const result = await this.authService.register(dto);
    return this.toResponse(result);
  }

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto.email, dto.password);
    return this.toResponse(result);
  }

  @Post('renew-token')
  async renewToken(@Body() dto: RenewTokenDto): Promise<AuthResponseDto> {
    const result = await this.authService.renewToken(dto.refreshToken);
    return this.toResponse(result);
  }

  private toResponse(result: AuthTokenPair): AuthResponseDto {
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      user: plainToInstance(UserResponseDto, result.user, {
        excludeExtraneousValues: true,
      }),
    };
  }
}