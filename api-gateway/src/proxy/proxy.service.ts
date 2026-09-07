import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CORRELATION_ID_HEADER } from '../common/correlation/correlation.constants.js';
import { AxiosResponse } from 'axios';

interface DownstreamUser {
  userId: string;
  role: string;
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Generate a short-lived internal JWT that downstream services
   * can trust.  Contains only the user's id and role.
   */
  issueInternalToken(user: DownstreamUser): string {
    return this.jwtService.sign({
      sub: user.userId,
      role: user.role,
      roles: [user.role],
    });
  }

  /**
   * Build the standard headers to forward to a downstream service:
   *  - Authorization: Bearer <internal-jwt>
   *  - X-Correlation-Id
   *  - Content-Type
   */
  private buildDownstreamHeaders(
    internalToken: string,
    correlationId: string,
    contentType: string = 'application/json',
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${internalToken}`,
      [CORRELATION_ID_HEADER]: correlationId,
      'Content-Type': contentType,
    };
  }

  private getServiceUrl(serviceKey: string): string {
    const url = this.config.get<string>(serviceKey);
    if (!url) {
      throw new Error(`Service URL not configured: ${serviceKey}`);
    }
    return url;
  }

  // ─── Products ──────────────────────────────────────────────

  async getProducts(
    internalToken: string,
    correlationId: string,
    query?: Record<string, string>,
  ): Promise<AxiosResponse> {
    const base = this.getServiceUrl('PRODUCT_SERVICE_URL');
    const url = `${base}/api/v1/products`;
    this.logger.debug({ url, correlationId }, 'Forwarding GET /products');

    return firstValueFrom(
      this.httpService.get(url, {
        headers: this.buildDownstreamHeaders(internalToken, correlationId),
        params: query,
      }),
    );
  }

  async getProductById(
    internalToken: string,
    correlationId: string,
    productId: string,
  ): Promise<AxiosResponse> {
    const base = this.getServiceUrl('PRODUCT_SERVICE_URL');
    const url = `${base}/api/v1/products/${productId}`;
    this.logger.debug({ url, correlationId }, 'Forwarding GET /products/:id');

    return firstValueFrom(
      this.httpService.get(url, {
        headers: this.buildDownstreamHeaders(internalToken, correlationId),
      }),
    );
  }

  // ─── Users ─────────────────────────────────────────────────

  async getMe(
    internalToken: string,
    correlationId: string,
  ): Promise<AxiosResponse> {
    const base = this.getServiceUrl('USER_SERVICE_URL');
    const url = `${base}/api/v1/users/me`;
    this.logger.debug({ url, correlationId }, 'Forwarding GET /users/me');

    return firstValueFrom(
      this.httpService.get(url, {
        headers: this.buildDownstreamHeaders(internalToken, correlationId),
      }),
    );
  }

  // ─── Orders ────────────────────────────────────────────────

  async createOrder(
    internalToken: string,
    correlationId: string,
    body: Record<string, unknown>,
  ): Promise<AxiosResponse> {
    const base = this.getServiceUrl('ORDER_SERVICE_URL');
    const url = `${base}/api/v1/orders`;
    this.logger.debug({ url, correlationId }, 'Forwarding POST /orders');

    return firstValueFrom(
      this.httpService.post(url, body, {
        headers: this.buildDownstreamHeaders(internalToken, correlationId),
      }),
    );
  }

  async getOrderById(
    internalToken: string,
    correlationId: string,
    orderId: string,
  ): Promise<AxiosResponse> {
    const base = this.getServiceUrl('ORDER_SERVICE_URL');
    const url = `${base}/api/v1/orders/${orderId}`;
    this.logger.debug({ url, correlationId }, 'Forwarding GET /orders/:id');

    return firstValueFrom(
      this.httpService.get(url, {
        headers: this.buildDownstreamHeaders(internalToken, correlationId),
      }),
    );
  }
}
