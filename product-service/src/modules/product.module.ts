import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../domain/product.entity';
import { TypeOrmProductRepository } from '../infrastructure/persistence/product.repository';
import { RedisCacheService } from '../infrastructure/cache/redis-cache.service';
import { ProductService } from '../application/product.service';
import { ProductController } from '../interface/http/product.controller';
import { PRODUCT_REPOSITORY } from '../domain/product-repository.interface';
import { AuthModule } from './auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), AuthModule],
  controllers: [ProductController],
  providers: [
    {
      provide: PRODUCT_REPOSITORY,
      useClass: TypeOrmProductRepository,
    },
    RedisCacheService,
    ProductService,
  ],
  exports: [ProductService],
})
export class ProductModule {}
