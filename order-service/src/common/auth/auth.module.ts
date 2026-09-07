import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InternalJwtStrategy } from '../guards/internal-jwt.strategy.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'internal-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.internalJwtSecret'),
        signOptions: { expiresIn: '5m' },
      }),
    }),
  ],
  providers: [InternalJwtStrategy],
  exports: [PassportModule, JwtModule],
})
export class AuthModule {}