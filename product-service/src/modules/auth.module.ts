import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InternalJwtStrategy } from '../infrastructure/auth/internal-jwt.strategy';
import { JwtAuthGuard } from '../infrastructure/auth/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'internal-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('INTERNAL_JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  providers: [InternalJwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
