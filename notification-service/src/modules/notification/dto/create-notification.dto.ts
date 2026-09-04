import { IsEnum, IsEmail, IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { NotificationKind } from '../../../database/entities/notification-delivery.entity.js';

export class CreateNotificationDto {
  @IsEnum(NotificationKind)
  kind!: NotificationKind;

  @IsEmail()
  @MaxLength(320)
  recipient!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  channel!: string;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  subject?: string;

  @IsString()
  @IsNotEmpty()
  body!: string;
}
