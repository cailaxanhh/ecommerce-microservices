import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator.js';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator.js';
import { OrderService } from './order.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import {
  OrderResponseDto,
  OrderCreatedResponseDto,
} from './dto/order-response.dto.js';
import { Order } from '../../database/entities/order.entity.js';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @Roles('customer', 'admin')
  @ApiOperation({ summary: 'create a new order' })
  @ApiResponse({
    status: 202,
    description: 'Order accepted for processing',
    type: OrderCreatedResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: JwtPayload,
    @CorrelationId() correlationId?: string,
  ): Promise<OrderCreatedResponseDto> {
    if (user.roles?.includes('customer') && dto.customerUserId !== user.sub) {
      dto.customerUserId = user.sub;
    }

    const result = await this.orderService.createOrder(dto, correlationId);
    return result;
  }

  @Get(':id')
  @Roles('customer', 'staff', 'admin')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({
    status: 200,
    description: 'Order found',
    type: OrderResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<OrderResponseDto> {
    const order = await this.orderService.getOrder(id, user);
    return this.mapToResponse(order);
  }

  @Get()
  @Roles('customer', 'staff', 'admin')
  @ApiOperation({ summary: 'List orders' })
  @ApiResponse({ status: 200, description: 'Orders listed' })
  async listOrders(
    @Query() query: ListOrdersQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    orders: OrderResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result = await this.orderService.listOrders(query, user);
    return {
      orders: result.orders.map((o) => this.mapToResponse(o)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Post(':id/cancel')
  @Roles('customer', 'staff', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled',
    type: OrderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Order cannot be cancelled' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancelOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OrderResponseDto> {
    const order = await this.orderService.cancelOrder(id, user, dto.reason);
    return this.mapToResponse(order);
  }

  private mapToResponse(order: Order): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = order.id;
    dto.orderNumber = order.orderNumber;
    dto.customerUserId = order.customerUserId;
    dto.status = order.status;
    dto.shippingAddressId = order.shippingAddressId;
    dto.totalAmount = order.totalAmount;
    dto.currency = order.currency;
    dto.paymentMethod = order.paymentMethod;
    dto.correlationId = order.correlationId;
    dto.version = order.version;
    dto.createdAt = order.createdAt;
    dto.updatedAt = order.updatedAt;
    dto.items = (order.items ?? []).map((item) => ({
      id: item.id,
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      name: item.name,
    }));
    return dto;
  }
}
