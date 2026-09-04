import { Exclude, Expose } from 'class-transformer';
import { AddressType } from '../../../domain/entities/address-type.enum.js';

@Exclude()
export class AddressResponseDto {
  @Expose()
  id!: string;

  @Expose()
  userId!: string;

  @Expose()
  line1!: string;

  @Expose()
  line2!: string | null;

  @Expose()
  city!: string;

  @Expose()
  state!: string | null;

  @Expose()
  country!: string;

  @Expose()
  postalCode!: string;

  @Expose()
  type!: AddressType;

  @Expose()
  isDefault!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}