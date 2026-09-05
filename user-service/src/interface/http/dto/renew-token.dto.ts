import { IsNotEmpty, IsString } from 'class-validator';

export class RenewTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}