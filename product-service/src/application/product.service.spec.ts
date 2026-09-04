import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { PRODUCT_REPOSITORY } from '../domain/product-repository.interface';
import { RedisCacheService } from '../infrastructure/cache/redis-cache.service';
import { NotFoundException } from '@nestjs/common';

describe('ProductService', () => {
  let service: ProductService;
  let mockRepo: any;
  let mockCache: any;

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn(),
      findBySku: jest.fn(),
      findByIds: jest.fn(),
      findBySkus: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PRODUCT_REPOSITORY, useValue: mockRepo },
        { provide: RedisCacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  describe('findById', () => {
    it('returns cached product when available', async () => {
      const fakeProduct = { id: 'abc', name: 'Test' };
      mockCache.get.mockResolvedValueOnce(fakeProduct);

      const result = await service.findById('abc');

      expect(result).toEqual(fakeProduct);
      expect(mockRepo.findById).not.toHaveBeenCalled();
    });

    it('falls back to DB and caches result', async () => {
      const fakeProduct = { id: 'abc', name: 'Test' };
      mockCache.get.mockResolvedValueOnce(null);
      mockRepo.findById.mockResolvedValueOnce(fakeProduct);

      const result = await service.findById('abc');

      expect(result).toEqual(fakeProduct);
      expect(mockCache.set).toHaveBeenCalledWith('product:abc', fakeProduct);
    });

    it('throws NotFoundException when product not found', async () => {
      mockCache.get.mockResolvedValueOnce(null);
      mockRepo.findById.mockResolvedValueOnce(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkExistence', () => {
    it('returns matching ids and skus', async () => {
      mockRepo.findByIds.mockResolvedValueOnce([{ id: '1' }, { id: '2' }]);
      mockRepo.findBySkus.mockResolvedValueOnce([{ sku: 'SKU-A' }]);

      const result = await service.checkExistence({
        ids: ['1', '2', '3'],
        skus: ['SKU-A', 'SKU-B'],
      });

      expect(result.existingIds).toEqual(['1', '2']);
      expect(result.existingSkus).toEqual(['SKU-A']);
    });
  });
});
