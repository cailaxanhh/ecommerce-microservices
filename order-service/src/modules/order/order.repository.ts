import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Order } from '../../database/entities/order.entity.js';
import { OrderItem } from '../../database/entities/order-item.entity.js';
import { OrderStatus } from '../order/enums/order-status.enum.js';

export interface CreateOrderData {
  customerUserId: string;
  orderNumber: string;
  shippingAddressId: string;
  totalAmount: number;
  currency: string;
  paymentMethod?: string;
  correlationId?: string;
  items: Array<{
    productId: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    name: string;
  }>;
}

@Injectable()
export class OrderRepository {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
  ) {}

  async createOrder(
    data: CreateOrderData,
    queryRunner: QueryRunner,
  ): Promise<Order> {
    const order = this.orderRepo.create({
      id: uuid(),
      orderNumber: data.orderNumber,
      customerUserId: data.customerUserId,
      status: OrderStatus.PENDING,
      shippingAddressId: data.shippingAddressId,
      totalAmount: data.totalAmount,
      currency: data.currency,
      paymentMethod: data.paymentMethod ?? null,
      correlationId: data.correlationId ?? null,
      version: 0,
    });

    const savedOrder = await queryRunner.manager.save(Order, order);

    const orderItems = data.items.map((item) => {
      return this.itemRepo.create({
        id: uuid(),
        orderId: savedOrder.id,
        productId: item.productId,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        name: item.name,
      });
    });

    await queryRunner.manager.save(OrderItem, orderItems);
    savedOrder.items = orderItems;
    return savedOrder;
  }

  async findById(id: string): Promise<Order | null> {
    return this.orderRepo.findOne({
      where: { id },
      relations: { items: true },
    });
  }

  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    return this.orderRepo.findOne({
      where: { orderNumber },
      relations: { items: true },
    });
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order | null> {
    await this.orderRepo.update(id, {
      status,
      version: () => 'version + 1',
    });
    return this.findById(id);
  }

  async findAll(options: {
    customerUserId?: string;
    status?: OrderStatus;
    page?: number;
    limit?: number;
  }): Promise<{ orders: Order[]; total: number }> {
    const { customerUserId, status, page = 1, limit = 20 } = options;

    const queryBuilder = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items');

    if (customerUserId) {
      queryBuilder.andWhere('order.customerUserId = :customerUserId', {
        customerUserId,
      });
    }

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    queryBuilder.orderBy('order.createdAt', 'DESC');

    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [orders, total] = await queryBuilder.getManyAndCount();

    return { orders, total };
  }

  async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Get count of orders created today for sequence number
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const count = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.createdAt >= :startOfDay', { startOfDay })
      .getCount();

    const sequence = String(count + 1).padStart(5, '0');
    return `ORD-${dateStr}-${sequence}`;
  }
}
