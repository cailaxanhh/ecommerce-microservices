import { Product } from './product.entity';

export interface ProductListParams {
  page: number;
  limit: number;
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export const PRODUCT_REPOSITORY = 'PRODUCT_REPOSITORY';

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findBySku(sku: string): Promise<Product | null>;
  findByIds(ids: string[]): Promise<Product[]>;
  findBySkus(skus: string[]): Promise<Product[]>;
  findMany(params: ProductListParams): Promise<PaginatedResult<Product>>;
  create(data: Partial<Product>): Promise<Product>;
  save(product: Product): Promise<Product>;
}
