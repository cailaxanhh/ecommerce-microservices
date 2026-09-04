import { Exclude, Expose } from 'class-transformer';
import { Product } from '../../../domain/product.entity';

@Exclude()
export class ProductResponseDto {
  @Expose()
  id!: string;

  @Expose()
  sku!: string;

  @Expose()
  name!: string;

  @Expose()
  description!: string;

  @Expose()
  category!: string;

  @Expose()
  price!: string;

  @Expose()
  currency!: string;

  @Expose()
  reservationAware!: boolean;

  @Expose()
  isActive!: boolean;

  @Expose()
  imageUrl!: string | null;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  static fromEntity(product: Product): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product.id;
    dto.sku = product.sku;
    dto.name = product.name;
    dto.description = product.description;
    dto.category = product.category;
    dto.price = product.price;
    dto.currency = product.currency;
    dto.reservationAware = product.reservationAware;
    dto.isActive = product.isActive;
    dto.imageUrl = product.imageUrl;
    dto.createdAt = product.createdAt;
    dto.updatedAt = product.updatedAt;
    return dto;
  }
}
