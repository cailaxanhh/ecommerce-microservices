import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaymentsService } from './payments.service.js';
import { Payment, PaymentStatus, LedgerEntry } from '../../database/entities/index.js';
import { PaymentProviderStrategy } from './strategies/payment-provider.strategy.js';
import { OutboxService } from '../outbox/outbox.service.js';

describe('PaymentsService', () => {
  let service: PaymentsService;

  const mockPaymentRepo = {
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    createQueryBuilder: vi.fn(),
  };

  const mockLedgerRepo = {
    create: vi.fn(),
    save: vi.fn(),
  };

  const mockPaymentProvider: PaymentProviderStrategy = {
    charge: vi.fn(),
    refund: vi.fn(),
  };

  const mockOutboxService = {
    append: vi.fn(),
    fetchPending: vi.fn(),
    markSent: vi.fn(),
  };

  const mockDataSource = {
    transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(LedgerEntry), useValue: mockLedgerRepo },
        { provide: PaymentProviderStrategy, useValue: mockPaymentProvider },
        { provide: OutboxService, useValue: mockOutboxService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('findById', () => {
    it('should return a payment by id', async () => {
      const mockPayment = { id: 'test-id', orderId: 'order-1' };
      mockPaymentRepo.findOne.mockResolvedValue(mockPayment);

      const result = await service.findById('test-id');
      expect(result).toEqual(mockPayment);
      expect(mockPaymentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
    });

    it('should return null if not found', async () => {
      mockPaymentRepo.findOne.mockResolvedValue(null);
      const result = await service.findById('nonexistent');
      expect(result).toBeNull();
    });
  });
});
