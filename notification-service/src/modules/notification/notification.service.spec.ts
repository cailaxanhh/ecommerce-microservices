import { Test, TestingModule } from '@nestjs/testing';
import { vi, Mocked, Mock } from 'vitest';
import { NotificationService } from './notification.service.js';
import {
  NotificationDelivery,
  NotificationStatus,
  NotificationKind,
} from '../../database/entities/notification-delivery.entity.js';
import { NotificationDeliveryRepository } from '../../database/repositories/notification-delivery.repository.js';
import { ProcessedEventRepository } from '../../database/repositories/processed-event.repository.js';
import { NotificationDispatcher } from '../kafka/dispatcher/notification-dispatcher.interface.js';
import { NotFoundException } from '@nestjs/common';

describe('NotificationService', () => {
  let service: NotificationService;
  let deliveryRepo: Mocked<NotificationDeliveryRepository>;

  const mockDelivery: NotificationDelivery = {
    id: 'test-uuid',
    kind: NotificationKind.EMAIL,
    recipient: 'test@example.com',
    channel: 'email',
    subject: 'Test Subject',
    body: 'Test Body',
    status: NotificationStatus.PENDING,
    providerToken: null,
    eventId: null,
    eventType: null,
    correlationId: null,
    errorMessage: null,
    sentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const deliveryRepoMock = {
      create: vi.fn().mockReturnValue(mockDelivery),
      save: vi.fn().mockImplementation((e) => Promise.resolve(e)),
      findById: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      findAll: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    };

    const dispatcherMock = {
      dispatch: vi.fn().mockResolvedValue({ success: true, providerToken: 'token-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: NotificationDeliveryRepository,
          useValue: deliveryRepoMock,
        },
        {
          provide: ProcessedEventRepository,
            useValue: {
              existsByEventIdAndType: vi.fn(),
              markProcessed: vi.fn(),
            },
        },
        {
          provide: NotificationDispatcher,
          useValue: dispatcherMock,
        },
      ],
    }).compile();

    service = module.get(NotificationService);
    deliveryRepo = module.get(NotificationDeliveryRepository) as Mocked<NotificationDeliveryRepository>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAndDispatch', () => {
    it('should create a delivery record and dispatch', async () => {
      const dto = {
        kind: NotificationKind.EMAIL,
        recipient: 'test@example.com',
        channel: 'email',
        subject: 'Hello',
        body: 'World',
      };

      const result = await service.createAndDispatch(dto);

      expect(deliveryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: NotificationKind.EMAIL,
          recipient: 'test@example.com',
          status: NotificationStatus.PENDING,
        }),
      );
      expect(deliveryRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should attach eventId and correlationId when provided', async () => {
      const dto = {
        kind: NotificationKind.EMAIL,
        recipient: 'test@example.com',
        channel: 'email',
        subject: 'Hello',
        body: 'World',
      };

      await service.createAndDispatch(dto, {
        eventId: 'evt-1',
        eventType: 'OrderConfirmed',
        correlationId: 'corr-1',
      });

      expect(deliveryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt-1',
          eventType: 'OrderConfirmed',
          correlationId: 'corr-1',
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a delivery record', async () => {
      (deliveryRepo.findById as Mock).mockResolvedValue(mockDelivery);
      const result = await service.findOne('test-uuid');
      expect(result.id).toBe('test-uuid');
    });

    it('should throw NotFoundException when not found', async () => {
      (deliveryRepo.findById as Mock).mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });
});
