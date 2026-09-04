import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { UserApplicationService } from '../../../user/user.application.service.js';
import { AddressApplicationService } from '../../../user/address.application.service.js';
import { CreateUserDto } from '../dto/create-user.dto.js';
import { UpdateUserDto } from '../dto/update-user.dto.js';
import { CreateAddressDto } from '../dto/create-address.dto.js';
import { UserResponseDto } from '../dto/user-response.dto.js';
import { AddressResponseDto } from '../dto/address-response.dto.js';
import { JwtAuthGuard } from '../../../common/jwt-auth.guard.js';
import { CurrentUser } from '../../../common/current-user.decorator.js';

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(
    private readonly userService: UserApplicationService,
    private readonly addressService: AddressApplicationService,
  ) {}

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.userService.create(dto);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser('sub') userId: string): Promise<UserResponseDto> {
    const user = await this.userService.findById(userId);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Get('by-email/:email')
  async findByEmail(@Param('email') email: string): Promise<UserResponseDto> {
    const user = await this.userService.findByEmail(email);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.userService.findById(id);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.update(id, dto);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Post(':id/addresses')
  async addAddress(
    @Param('id') userId: string,
    @Body() dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    const address = await this.addressService.addAddress(userId, dto);
    return plainToInstance(AddressResponseDto, address, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id/addresses')
  async listAddresses(
    @Param('id') userId: string,
  ): Promise<AddressResponseDto[]> {
    const addresses = await this.addressService.listAddresses(userId);
    return plainToInstance(AddressResponseDto, addresses, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id/addresses/:addressId')
  async getAddress(
    @Param('id') userId: string,
    @Param('addressId') addressId: string,
  ): Promise<AddressResponseDto> {
    const address = await this.addressService.getAddress(userId, addressId);
    if (!address) {
      throw new NotFoundException(
        `Address ${addressId} not found for user ${userId}`,
      );
    }
    return plainToInstance(AddressResponseDto, address, {
      excludeExtraneousValues: true,
    });
  }
}
