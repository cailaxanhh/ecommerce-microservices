import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from '../../domain/entities/address.entity.js';
import { AddressRepository } from '../../domain/interfaces/address-repository.interface.js';

@Injectable()
export class TypeOrmAddressRepository extends AddressRepository {
  constructor(
    @InjectRepository(Address)
    private readonly repo: Repository<Address>,
  ) {
    super();
  }

  async findByUserId(userId: string): Promise<Address[]> {
    return this.repo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async findById(id: string): Promise<Address | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(data: Partial<Address>): Promise<Address> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }
}