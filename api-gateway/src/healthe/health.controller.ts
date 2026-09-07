import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { DownstreamHealthIndicator } from './health.indicator.js';
import { HealthCheckService } from '@nestjs/terminus';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/public.decorator.js';

@Controller()
export class HealthController {
  private readonly downstream: DownstreamHealthIndicator;

  constructor(
    private readonly healthCheck: HealthCheckService,
    httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    this.downstream = new DownstreamHealthIndicator(httpService);
  }

  @Public()
  @Get('health')
  @HttpCode(HttpStatus.OK)
  health() {
    return {
      status: 'ok',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('health/ready')
  @HttpCode(HttpStatus.OK)
  readiness() {
    return this.healthCheck.check([
      () => this.downstream.isHealthy('userService', this.config.get('USER_SERVICE_URL')!),
      () => this.downstream.isHealthy('productService', this.config.get('PRODUCT_SERVICE_URL')!),
      () =>
        this.downstream.isHealthy('orderService', this.config.get<string>('ORDER_SERVICE_URL')!),
    ]);
  }
}
