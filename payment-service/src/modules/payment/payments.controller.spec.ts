import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PolicyGuard } from '../auth/policy/policy.guard.js';

describe('PaymentsController', () => {
  let controller: PaymentsController;

  const mockPaymentsService = {
    charge: vi.fn(),
    findById: vi.fn(),
    requestRefund: vi.fn(),
    findAll: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PolicyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
