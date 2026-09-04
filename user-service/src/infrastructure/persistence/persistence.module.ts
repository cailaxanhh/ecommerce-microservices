import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../domain/entities/user.entity.js';
import { Address } from '../../domain/entities/address.entity.js';
import { UserRepository } from '../../domain/interfaces/user-repository.interface.js';
import { AddressRepository } from '../../domain/interfaces/address-repository.interface.js';
import { TypeOrmUserRepository } from './user.repository.js';
import { TypeOrmAddressRepository } from './address.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Address])],
  providers: [
    {
      provide: UserRepository,
      useClass: TypeOrmUserRepository,
    },
    {
      provide: AddressRepository,
      useClass: TypeOrmAddressRepository,
    },
  ],
  exports: [UserRepository, AddressRepository],
})
export class PersistenceModule {}