import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../database/entities/order.entity.js';
import { OrderItem } from '../../database/entities/order-item.entity.js';
import { OrderRepository } from './order.repository.js';
import { OrderService } from './order.service.js';
import { OrderController } from './order.controller.js';
import { OutboxModule } from '../outbox/outbox.module.js';
import { AuthModule } from '../../common/auth/auth.module.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'internal-jwt' }),
    TypeOrmModule.forFeature([Order, OrderItem]),
    OutboxModule,
    AuthModule,
  ],
  providers: [OrderRepository, OrderService],
  controllers: [OrderController],
  exports: [OrderRepository, OrderService],
})
export class OrderModule {}
