import { UserResponseDto } from './user-response.dto.js';

export class AuthResponseDto {
  accessToken!: string;

  refreshToken!: string;

  tokenType!: 'Bearer';

  expiresIn!: number;

  user!: UserResponseDto;
}