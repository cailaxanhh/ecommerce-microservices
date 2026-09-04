import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationStatus } from '../../../database/entities/notification-delivery.entity.js';

export class ListNotificationsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsString()
  @IsOptional()
  kind?: string;

  @IsEnum(NotificationStatus)
  @IsOptional()
  status?: NotificationStatus;

  @IsString()
  @IsOptional()
  recipientEmail?: string;
}
