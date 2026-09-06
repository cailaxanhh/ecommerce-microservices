import { Module } from '@nestjs/common';
import { PolicyService } from './policy.service.js';
import { PolicyGuard } from './policy.guard.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [PolicyService, PolicyGuard],
  exports: [PolicyService, PolicyGuard],
})
export class PolicyModule {}
