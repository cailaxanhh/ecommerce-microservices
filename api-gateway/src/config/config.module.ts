import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validationSchema } from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      validationSchema,
    }),
  ],
})
export class AppConfigModule {}
