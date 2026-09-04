import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Product } from '../domain/product.entity';
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
  ProductListParams,
  PaginatedResult,
} from '../domain/product-repository.interface';
import { RedisCacheService } from '../infrastructure/cache/redis-cache.service';
import { CreateProductDto } from '../interface/http/dto/create-product.dto';
import { UpdateProductDto } from '../interface/http/dto/update-product.dto';

const CACHE_PREFIX = 'product';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepo: ProductRepository,
    private readonly cache: RedisCacheService,
  ) {}

  async list(params: ProductListParams): Promise<PaginatedResult<Product>> {
    const cacheKey = this.buildListCacheKey(params);
    const cached = await this.cache.get<PaginatedResult<Product>>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    const result = await this.productRepo.findMany(params);
    await this.cache.set(cacheKey, result);
    return result;
  }

  async findById(id: string): Promise<Product> {
    const cacheKey = `${CACHE_PREFIX}:${id}`;
    const cached = await this.cache.get<Product>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    await this.cache.set(cacheKey, product);
    return product;
  }

  async findPriceById(id: string): Promise<{ price: string; currency: string }> {
    const cacheKey = `${CACHE_PREFIX}:price:${id}`;
    const cached = await this.cache.get<{ price: string; currency: string }>(cacheKey);
    if (cached) {
      return cached;
    }

    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    const result = { price: product.price, currency: product.currency };
    await this.cache.set(cacheKey, result);
    return result;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const product = await this.productRepo.create({
      sku: dto.sku,
      name: dto.name,
      description: dto.description ?? '',
      category: dto.category ?? '',
      price: String(dto.price),
      currency: dto.currency ?? 'USD',
      reservationAware: dto.reservationAware ?? true,
      isActive: dto.isActive ?? true,
      imageUrl: dto.imageUrl ?? null,
    });

    await this.invalidateListCaches();
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findById(id);

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.category !== undefined) product.category = dto.category;
    if (dto.price !== undefined) product.price = String(dto.price);
    if (dto.currency !== undefined) product.currency = dto.currency;
    if (dto.reservationAware !== undefined) product.reservationAware = dto.reservationAware;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;
    if (dto.imageUrl !== undefined) product.imageUrl = dto.imageUrl;

    const saved = await this.productRepo.save(product);

    await this.cache.del(`${CACHE_PREFIX}:${id}`, `${CACHE_PREFIX}:price:${id}`);
    await this.invalidateListCaches();

    return saved;
  }

  async checkExistence(params: {
    ids?: string[];
    skus?: string[];
  }): Promise<{
    existingIds: string[];
    existingSkus: string[];
    missing: string[];
    exists: boolean;
  }> {
    const existingIds: string[] = [];
    const existingSkus: string[] = [];

    if (params.ids?.length) {
      const products = await this.productRepo.findByIds(params.ids);
      existingIds.push(...products.map((p) => p.id));
    }

    if (params.skus?.length) {
      const products = await this.productRepo.findBySkus(params.skus);
      existingSkus.push(...products.map((p) => p.sku));
    }

    const requestedIds = params.ids ?? [];
    const missing = requestedIds.filter((id) => !existingIds.includes(id));

    return {
      existingIds,
      existingSkus,
      missing,
      exists: requestedIds.every((id) => existingIds.includes(id)),
    };
  }

  private buildListCacheKey(params: ProductListParams): string {
    const parts = [
      CACHE_PREFIX,
      'list',
      String(params.page),
      String(params.limit),
      params.category ?? '*',
      params.search ?? '*',
      String(params.minPrice ?? '*'),
      String(params.maxPrice ?? '*'),
    ];
    return parts.join(':');
  }

  private async invalidateListCaches(): Promise<void> {
    await this.cache.delPattern(`${CACHE_PREFIX}:list:*`);
  }
}
