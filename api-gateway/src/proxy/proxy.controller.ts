import { Controller, Get, Post, Param, Body, Query, Req, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ProxyService } from './proxy.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { CORRELATION_ID_HEADER } from '../common/correlation/correlation.constants';
import type { TypedRequest } from '../common/types/typed-request';

@Controller()
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);

  constructor(private readonly proxyService: ProxyService) {}

  private getUser(req: TypedRequest) {
    return {
      userId: req.user?.userId ?? '',
      role: req.user?.role ?? '',
    };
  }

  private getCorrelationId(req: TypedRequest): string {
    return (
      req.correlationId || (req.headers[CORRELATION_ID_HEADER.toLowerCase()] as string) || 'unknown'
    );
  }

  private async forward(
    res: Response,
    promise: Promise<{ status: number; data: unknown }>,
    correlationId: string,
  ): Promise<unknown> {
    try {
      const downstream = await promise;
      res.status(downstream.status);
      return downstream.data;
    } catch (error: any) {
      const status = error?.response?.status ?? 502;
      const message =
        status === 502
          ? 'Downstream service unavailable'
          : (error?.response?.data?.message ?? error.message);
      this.logger.error({ correlationId, status, err: error.message }, 'Downstream request failed');
      res.status(status);
      return { statusCode: status, message };
    }
  }

  // ─── Products ──────────────────────────────────────────────

  @Get('products')
  async getProducts(
    @Req() req: TypedRequest,
    @Res({ passthrough: true }) res: Response,
    @Query() query: ListProductsQueryDto,
  ) {
    const user = this.getUser(req);
    const correlationId = this.getCorrelationId(req);
    const internalToken = this.proxyService.issueInternalToken(user);
    res.set('Cache-Control', 'public, max-age=60');
    return this.forward(
      res,
      this.proxyService.getProducts(
        internalToken,
        correlationId,
        query as unknown as Record<string, string>,
      ),
      correlationId,
    );
  }

  @Get('products/:id')
  async getProductById(
    @Param('id') id: string,
    @Req() req: TypedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = this.getUser(req);
    const correlationId = this.getCorrelationId(req);
    const internalToken = this.proxyService.issueInternalToken(user);
    return this.forward(
      res,
      this.proxyService.getProductById(internalToken, correlationId, id),
      correlationId,
    );
  }

  // ─── Users ─────────────────────────────────────────────────

  @Get('users/me')
  async getMe(@Req() req: TypedRequest, @Res({ passthrough: true }) res: Response) {
    const user = this.getUser(req);
    const correlationId = this.getCorrelationId(req);
    const internalToken = this.proxyService.issueInternalToken(user);
    return this.forward(res, this.proxyService.getMe(internalToken, correlationId), correlationId);
  }

  // ─── Orders ────────────────────────────────────────────────

  @Post('orders')
  async createOrder(
    @Body() body: CreateOrderDto,
    @Req() req: TypedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = this.getUser(req);
    const correlationId = this.getCorrelationId(req);
    const internalToken = this.proxyService.issueInternalToken(user);
    return this.forward(
      res,
      this.proxyService.createOrder(
        internalToken,
        correlationId,
        body as unknown as Record<string, unknown>,
      ),
      correlationId,
    );
  }

  @Get('orders/:id')
  async getOrderById(
    @Param('id') id: string,
    @Req() req: TypedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = this.getUser(req);
    const correlationId = this.getCorrelationId(req);
    const internalToken = this.proxyService.issueInternalToken(user);
    return this.forward(
      res,
      this.proxyService.getOrderById(internalToken, correlationId, id),
      correlationId,
    );
  }
}
