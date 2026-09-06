import { IsString, IsNumber, IsPositive, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 'order-abc-123' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  orderId!: string;

  @ApiProperty({ example: 'user-uuid-456' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  customerUserId!: string;

  @ApiProperty({ example: 99.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiProperty({ example: 'tok_visa_4242' })
  @IsString()
  @MinLength(1)
  cardToken!: string;

  @ApiPropertyOptional({ example: 'idem-order-abc-123' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
