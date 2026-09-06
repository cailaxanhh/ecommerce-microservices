import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { CreateOrderData, OrderRepository } from './order.repository.js';
import { ValidationService } from '../validation/validation.service.js';
import { OutboxRepository } from '../outbox/outbox.repository.js';
import { ConfigService } from '@nestjs/config';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderStatus } from './enums/order-status.enum.js';
import { Order } from '../../database/entities/order.entity.js';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto.js';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly orderRepository: OrderRepository,
    private readonly validationService: ValidationService,
    private readonly outboxRepository: OutboxRepository,
    private readonly configService: ConfigService,
  ) {}

  async createOrder(
    dto: CreateOrderDto,
    correlationId?: string,
  ): Promise<{ orderId: string; status: OrderStatus; orderNumber: string }> {
    // Validate user, address, product
    const user = await this.validationService.validateUser(
      dto.customerUserId,
      correlationId,
    );
    this.logger.debug({ userId: user.id }, 'User validated');

    const address = await this.validationService.validateAddress(
      dto.customerUserId,
      dto.shippingAddressId,
      correlationId,
    );
    this.logger.debug({ addressId: address.id }, 'Address validated');

    const validatedItems =
      await this.validationService.validateAndPriceProducts(
        dto.items,
        correlationId,
      );
    this.logger.debug(
      { itemCount: validatedItems.length },
      'Products validated',
    );

    const totalAmount = validatedItems.reduce(
      (sum, item) => sum + item.validatedPrice * item.quantity,
      0,
    );

    const orderNumber = await this.orderRepository.generateOrderNumber();

    // Build order data
    const orderData: CreateOrderData = {
      customerUserId: dto.customerUserId,
      orderNumber,
      shippingAddressId: dto.shippingAddressId,
      totalAmount,
      currency: 'USD',
      paymentMethod: dto.paymentMethod,
      correlationId,
      items: validatedItems.map((item) => ({
        productId: item.productId,
        sku: item.validatedSku,
        quantity: item.quantity,
        unitPrice: item.validatedPrice,
        lineTotal: item.validatedPrice * item.quantity,
        name: item.validatedName,
      })),
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.orderRepository.createOrder(
        orderData,
        queryRunner,
      );

      await this.outboxRepository.createEntry(
        {
          aggregateId: order.id,
          eventType: 'OrderCreated',
          payload: {
            eventType: 'OrderCreated',
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerUserId: order.customerUserId,
            items: order.items.map((item) => ({
              productId: item.productId,
              sku: item.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
              name: item.name,
            })),
            shippingAddressId: order.shippingAddressId,
            totalAmount: order.totalAmount,
            currency: order.currency,
            paymentMethod: order.paymentMethod,
            timestamp: new Date().toISOString(),
          },
          headers: {
            correlationId: correlationId || order.correlationId,
            eventId: uuid(),
          },
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalAmount,
          itemCount: order.items.length,
        },
        'Order created successfully',
      );

      return {
        orderId: order.id,
        status: OrderStatus.PENDING,
        orderNumber: order.orderNumber,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        { error },
        'Failed to create order — transaction rolled back',
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getOrder(
    orderId: string,
    currentUser: { sub: string; roles?: string[] },
  ): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    this.checkRoles(order, currentUser);

    return order;
  }

  async listOrders(
    query: ListOrdersQueryDto,
    currentUser: { sub: string; roles?: string[] },
  ): Promise<{ orders: Order[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const isAdminOrSupport =
      currentUser.roles?.includes('admin') ||
      currentUser.roles?.includes('support');

    const customerUserId = isAdminOrSupport ? undefined : currentUser.sub;

    const { orders, total } = await this.orderRepository.findAll({
      customerUserId,
      status: query.status,
      page,
      limit,
    });

    return { orders, total, page, limit };
  }

  async cancelOrder(
    orderId: string,
    currentUser: { sub: string; roles?: string[] },
    reason?: string,
  ): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    this.checkRoles(order, currentUser);

    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        `Order ${orderId} cannot be cancelled. Current status: ${order.status}`,
      );
    }

    const updatedOrder = await this.orderRepository.updateStatus(
      orderId,
      OrderStatus.CANCELLED,
    );
    if (!updatedOrder) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    await this.outboxRepository.createEntry({
      aggregateId: orderId,
      eventType: 'OrderCancelled',
      payload: {
        eventType: 'OrderCancelled',
        orderId,
        orderNumber: order.orderNumber,
        customerUserId: order.customerUserId,
        reason: reason || 'Cancelled by user',
        cancelledBy: currentUser.sub,
        timestamp: new Date().toISOString(),
      },
      headers: {
        correlationId: order.correlationId,
        eventId: uuid(),
      },
    });

    this.logger.log(
      { orderId, cancelledBy: currentUser.sub, reason },
      'Order cancelled',
    );

    return updatedOrder;
  }

  private checkRoles(
    order: Order,
    currentUser: { sub: string; roles?: string[] },
  ): void {
    const roles = currentUser.roles ?? [];
    const isAdminOrSupport =
      roles.includes('admin') || roles.includes('support');

    if (!isAdminOrSupport && order.customerUserId !== currentUser.sub) {
      throw new ForbiddenException(
        'You do not have permission to access this order',
      );
    }
  }
}
