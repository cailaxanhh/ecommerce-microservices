import { Address } from '../entities/address.entity.js';

export abstract class AddressRepository {
  abstract findByUserId(userId: string): Promise<Address[]>;
  abstract findById(id: string): Promise<Address | null>;
  abstract create(data: Partial<Address>): Promise<Address>;
}