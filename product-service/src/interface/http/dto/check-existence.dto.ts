import { IsArray, IsOptional, ArrayMaxSize } from 'class-validator';

export class CheckExistenceDto {
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(200)
  ids?: string[];

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(200)
  skus?: string[];
}
