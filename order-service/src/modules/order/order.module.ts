import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../database/entities/order.entity.js';
import { OrderItem } from '../../database/entities/order-item.entity.js';
import { OrderRepository } from './order.repository.js';
import { OrderService } from './order.service.js';
import { OrderController } from './order.controller.js';
import { OutboxModule } from '../outbox/outbox.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem]), OutboxModule],
  providers: [OrderRepository, OrderService],
  controllers: [OrderController],
  exports: [OrderRepository, OrderService],
})
export class OrderModule {}
