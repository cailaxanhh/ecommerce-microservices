import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserApplicationService } from './user.application.service.js';
import { UserRepository } from '../domain/interfaces/user-repository.interface.js';
import { User } from '../domain/entities/user.entity.js';

describe('UserApplicationService', () => {
  let service: UserApplicationService;
  let userRepo: {
    findById: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    userRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };
    service = new UserApplicationService(userRepo as unknown as UserRepository);
    vi.clearAllMocks();
  });

  const baseInput = {
    email: 'jane.doe@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  };

  describe('create', () => {
    it('creates a user when the email is not taken', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue({ id: 'user-1', ...baseInput } as User);

      const result = await service.create(baseInput);

      expect(userRepo.create).toHaveBeenCalledWith({
        email: baseInput.email,
        firstName: baseInput.firstName,
        lastName: baseInput.lastName,
        phone: null,
        passwordHash: null,
      });
      expect(result).toEqual({ id: 'user-1', ...baseInput });
    });

    it('throws ConflictException when the email is already registered', async () => {
      userRepo.findByEmail.mockResolvedValue({ id: 'existing', ...baseInput } as User);

      await expect(service.create(baseInput)).rejects.toThrow(ConflictException);
      expect(userRepo.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException on a unique-violation from the database', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockRejectedValue({ code: '23505' });

      await expect(service.create(baseInput)).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      const user = { id: 'user-1', ...baseInput } as User;
      userRepo.findById.mockResolvedValue(user);

      await expect(service.findById('user-1')).resolves.toBe(user);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('saves the merged user', async () => {
      const user = {
        id: 'user-1',
        email: baseInput.email,
        firstName: 'Jane',
        lastName: 'Doe',
        isActive: true,
      } as User;
      userRepo.findById.mockResolvedValue(user);
      userRepo.save.mockResolvedValue(user);

      const result = await service.update('user-1', { firstName: 'Janet' });

      expect(result.firstName).toBe('Janet');
      expect(userRepo.save).toHaveBeenCalledWith(user);
    });
  });
});