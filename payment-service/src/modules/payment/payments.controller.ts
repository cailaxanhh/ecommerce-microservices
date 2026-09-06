import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PolicyGuard } from '../auth/policy/policy.guard.js';
import { Policy } from '../auth/policy/policy.decorator.js';
import { AuthSubject } from '../auth/policy/policy.service.js';
import { PaymentsService } from './payments.service.js';
import type { CreatePaymentDto } from './dto/create-payment.dto.js';
import type { RefundPaymentDto } from './dto/refund-payment.dto.js';
import type { QueryPaymentsDto } from './dto/query-payments.dto.js';
import type { TypedRequest } from '../../common/types/typed-request.js';

@Controller('payments')
@UseGuards(JwtAuthGuard, PolicyGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /payments — charge a card (sync wrapper)
   */
  @Post()
  @Policy('payment:create')
  @HttpCode(HttpStatus.CREATED)
  async charge(@Body() dto: CreatePaymentDto, @Req() req: TypedRequest) {
    const user = req.user as AuthSubject;
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;

    const payment = await this.paymentsService.charge({
      orderId: dto.orderId,
      customerUserId: dto.customerUserId,
      amount: dto.amount,
      currency: dto.currency || 'USD',
      cardToken: dto.cardToken,
      idempotencyKey: dto.idempotencyKey,
      correlationId,
    });

    return {
      paymentId: payment.id,
      status: payment.status,
    };
  }

  /**
   * GET /payments/:id — single payment (ABAC filtered)
   */
  @Get(':id')
  @Policy('payment:view')
  async findOne(@Param('id') id: string, @Req() req: TypedRequest) {
    const user = req.user as AuthSubject;
    const payment = await this.paymentsService.findById(id);

    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }

    // Attach resource attributes so PolicyGuard can evaluate region/ownership
    (req as any).policyResource = {
      customerUserId: payment.customerUserId,
      region: undefined, // Would come from a customer→region lookup in production
    };

    return payment;
  }

  /**
   * POST /payments/:id/refund — request a refund
   */
  @Post(':id/refund')
  @Policy('payment:refund')
  @HttpCode(HttpStatus.OK)
  async refund(@Param('id') id: string, @Body() dto: RefundPaymentDto, @Req() req: TypedRequest) {
    const user = req.user as AuthSubject;
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;

    const payment = await this.paymentsService.findById(id);
    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }

    // Attach refund amount for PolicyGuard to check approval limit
    const refundAmount = dto.amount ?? Number(payment.amount) - Number(payment.refundedAmount);
    (req as any).policyResource = {
      customerUserId: payment.customerUserId,
      refundAmount,
    };

    const updated = await this.paymentsService.requestRefund({
      paymentId: id,
      amount: dto.amount,
      reason: dto.reason,
      correlationId,
    });

    return updated;
  }

  /**
   * GET /payments — list payments (ABAC filtered by service)
   */
  @Get()
  @Policy('payment:list')
  async findAll(@Query() query: QueryPaymentsDto, @Req() req: TypedRequest) {
    const user = req.user as AuthSubject;

    // ABAC: apply filter based on role
    const filters: Record<string, unknown> = { ...query };

    if (user.role === 'customer') {
      // Customers can only see their own payments
      filters.customerUserId = user.sub;
    }
    // Support agents would get a region filter in production
    // (requires a customer→region lookup service)

    return this.paymentsService.findAll({
      orderId: filters.orderId as string | undefined,
      customerUserId: filters.customerUserId as string | undefined,
      status: filters.status as any,
      page: filters.page as number | undefined,
      limit: filters.limit as number | undefined,
    });
  }
}
