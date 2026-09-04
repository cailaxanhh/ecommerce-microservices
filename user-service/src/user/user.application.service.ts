import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { UserRepository } from '../domain/interfaces/user-repository.interface.js';
import { User } from '../domain/entities/user.entity.js';

@Injectable()
export class UserApplicationService {
  constructor(private readonly userRepo: UserRepository) {}

  async create(data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    password?: string;
  }): Promise<User> {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    let passwordHash: string | null = null;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 10);
    }

    try {
      return await this.userRepo.create({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ?? null,
        passwordHash,
      });
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('A user with this email already exists');
      }
      throw err;
    }
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    return user;
  }

  async update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      isActive?: boolean;
    },
  ): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, data);
    return this.userRepo.save(user);
  }
}