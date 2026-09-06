import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { ValidationService } from './validation.service.js';

@Global()
@Module({
  imports: [HttpModule],
  providers: [ValidationService],
  exports: [ValidationService],
})
export class ValidationModule {}
