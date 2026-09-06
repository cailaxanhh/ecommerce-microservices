import { IsNumber, IsPositive, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefundPaymentDto {
  @ApiPropertyOptional({
    example: 50.0,
    description: 'Partial refund amount; omit for full refund',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ example: 'Customer requested return' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
