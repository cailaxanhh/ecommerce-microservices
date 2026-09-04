import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddressApplicationService } from './address.application.service.js';
import { AddressRepository } from '../domain/interfaces/address-repository.interface.js';
import { UserRepository } from '../domain/interfaces/user-repository.interface.js';
import { Address } from '../domain/entities/address.entity.js';
import { User } from '../domain/entities/user.entity.js';
import { AddressType } from '../domain/entities/address-type.enum.js';

describe('AddressApplicationService', () => {
  let service: AddressApplicationService;
  let addressRepo: {
    findByUserId: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let userRepo: {
    findById: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    addressRepo = {
      findByUserId: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
    };
    userRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };
    service = new AddressApplicationService(
      addressRepo as unknown as AddressRepository,
      userRepo as unknown as UserRepository,
    );
    vi.clearAllMocks();
  });

  describe('addAddress', () => {
    it('creates an address for an existing user, defaulting type to HOME', async () => {
      userRepo.findById.mockResolvedValue({ id: 'user-1' } as User);
      addressRepo.create.mockResolvedValue({ id: 'addr-1', userId: 'user-1' } as Address);

      const result = await service.addAddress('user-1', {
        line1: '1 Main St',
        city: 'Hanoi',
        country: 'VN',
        postalCode: '100000',
      });

      expect(userRepo.findById).toHaveBeenCalledWith('user-1');
      expect(addressRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        line1: '1 Main St',
        line2: null,
        city: 'Hanoi',
        state: null,
        country: 'VN',
        postalCode: '100000',
        type: AddressType.HOME,
        isDefault: false,
      });
      expect(result).toEqual({ id: 'addr-1', userId: 'user-1' });
    });

    it('consults the user repository before creating the address', async () => {
      userRepo.findById.mockResolvedValue(null);
      addressRepo.create.mockResolvedValue({ id: 'addr-1', userId: 'user-1' } as Address);

      const result = await service.addAddress('user-1', {
        line1: '1 Main St',
        city: 'Hanoi',
        country: 'VN',
        postalCode: '100000',
      });

      expect(userRepo.findById).toHaveBeenCalledWith('user-1');
      expect(addressRepo.create).toHaveBeenCalled();
      expect(result).toEqual({ id: 'addr-1', userId: 'user-1' });
    });
  });

  describe('listAddresses', () => {
    it('returns all addresses for the user', async () => {
      userRepo.findById.mockResolvedValue({ id: 'user-1' } as User);
      const addresses = [{ id: 'addr-1' }, { id: 'addr-2' }] as Address[];
      addressRepo.findByUserId.mockResolvedValue(addresses);

      await expect(service.listAddresses('user-1')).resolves.toEqual(addresses);
      expect(addressRepo.findByUserId).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getAddress', () => {
    it('returns the address only when it belongs to the user', async () => {
      userRepo.findById.mockResolvedValue({ id: 'user-1' } as User);
      addressRepo.findById.mockResolvedValue({
        id: 'addr-1',
        userId: 'user-1',
      } as Address);

      await expect(service.getAddress('user-1', 'addr-1')).resolves.toMatchObject({
        id: 'addr-1',
      });
    });

    it('returns null when the address belongs to another user', async () => {
      userRepo.findById.mockResolvedValue({ id: 'user-1' } as User);
      addressRepo.findById.mockResolvedValue({
        id: 'addr-1',
        userId: 'user-2',
      } as Address);

      await expect(service.getAddress('user-1', 'addr-1')).resolves.toBeNull();
    });
  });
});