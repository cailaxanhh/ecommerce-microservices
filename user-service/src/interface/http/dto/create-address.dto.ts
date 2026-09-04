import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AddressType } from '../../../domain/entities/address-type.enum.js';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  line2?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  state?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  country!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  postalCode!: string;

  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}