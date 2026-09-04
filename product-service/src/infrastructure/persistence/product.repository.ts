import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product } from '../../domain/product.entity';
import {
  ProductRepository,
  ProductListParams,
  PaginatedResult,
} from '../../domain/product-repository.interface';

@Injectable()
export class TypeOrmProductRepository implements ProductRepository {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
  ) {}

  async findById(id: string): Promise<Product | null> {
    return this.repo.findOneBy({ id });
  }

  async findBySku(sku: string): Promise<Product | null> {
    return this.repo.findOneBy({ sku });
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    if (!ids.length) return [];
    return this.repo.findBy({ id: In(ids) } as any);
  }

  async findBySkus(skus: string[]): Promise<Product[]> {
    if (!skus.length) return [];
    return this.repo.createQueryBuilder('p').where('p.sku IN (:...skus)', { skus }).getMany();
  }

  async findMany(params: ProductListParams): Promise<PaginatedResult<Product>> {
    const qb = this.repo.createQueryBuilder('p');

    if (params.category) {
      qb.andWhere('p.category = :category', { category: params.category });
    }

    if (params.search) {
      qb.andWhere('(p.name ILIKE :search OR p.description ILIKE :search)', {
        search: `%${params.search}%`,
      });
    }

    if (params.minPrice !== undefined) {
      qb.andWhere('p.price >= :minPrice', { minPrice: params.minPrice });
    }

    if (params.maxPrice !== undefined) {
      qb.andWhere('p.price <= :maxPrice', { maxPrice: params.maxPrice });
    }

    const total = await qb.getCount();

    const data = await qb
      .orderBy('p.createdAt', 'DESC')
      .skip((params.page - 1) * params.limit)
      .take(params.limit)
      .getMany();

    return { data, total, page: params.page, limit: params.limit };
  }

  async create(data: Partial<Product>): Promise<Product> {
    const product = this.repo.create(data);
    return this.repo.save(product);
  }

  async save(product: Product): Promise<Product> {
    return this.repo.save(product);
  }
}
