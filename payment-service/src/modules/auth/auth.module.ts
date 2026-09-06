import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy.js';
import { PolicyModule } from './policy/policy.module.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('app.jwt.secret'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
    PolicyModule,
  ],
  providers: [JwtStrategy],
  exports: [JwtModule, PassportModule, PolicyModule],
})
export class AuthModule {}
