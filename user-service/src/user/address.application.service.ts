import { Injectable } from '@nestjs/common';
import { AddressRepository } from '../domain/interfaces/address-repository.interface.js';
import { UserRepository } from '../domain/interfaces/user-repository.interface.js';
import { Address } from '../domain/entities/address.entity.js';
import { AddressType } from '../domain/entities/address-type.enum.js';

@Injectable()
export class AddressApplicationService {
  constructor(
    private readonly addressRepo: AddressRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async addAddress(
    userId: string,
    data: {
      line1: string;
      line2?: string;
      city: string;
      state?: string;
      country: string;
      postalCode: string;
      type?: AddressType;
      isDefault?: boolean;
    },
  ): Promise<Address> {
    await this.userRepo.findById(userId);

    return this.addressRepo.create({
      userId,
      line1: data.line1,
      line2: data.line2 ?? null,
      city: data.city,
      state: data.state ?? null,
      country: data.country,
      postalCode: data.postalCode,
      type: data.type ?? AddressType.HOME,
      isDefault: data.isDefault ?? false,
    });
  }

  async listAddresses(userId: string): Promise<Address[]> {
    await this.userRepo.findById(userId);
    return this.addressRepo.findByUserId(userId);
  }

  async getAddress(userId: string, addressId: string): Promise<Address | null> {
    await this.userRepo.findById(userId);
    const address = await this.addressRepo.findById(addressId);
    return address && address.userId === userId ? address : null;
  }
}