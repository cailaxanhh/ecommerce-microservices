import { HttpService } from '@nestjs/axios';
import { type HealthIndicatorResult } from '@nestjs/terminus';
import { firstValueFrom } from 'rxjs';

export class DownstreamHealthIndicator {
  constructor(private readonly httpService: HttpService) {}

  async isHealthy(key: string, url: string): Promise<HealthIndicatorResult> {
    try {
      await firstValueFrom(this.httpService.get(`${url}/api/v1/health`, { timeout: 3000 }));
      return {
        [key]: {
          status: 'up',
        },
      };
    } catch (error) {
      return {
        [key]: {
          status: 'down',
          message: `${key} unreachable`,
        },
      };
    }
  }
}
