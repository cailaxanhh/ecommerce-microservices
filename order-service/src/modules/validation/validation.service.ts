import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateOrderItemDto } from '../order/dto/create-order.dto.js';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface ValidatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface ValidatedAddress {
  id: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}
export interface ValidatedProduct {
  id: string;
  name: string;
  price: number;
  sku: string;
}

export interface ValidatedOrderItem extends CreateOrderItemDto {
  validatedPrice: number;
  validatedName: string;
  validatedSku: string;
}

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);
  private readonly userServiceUrl: string;
  private readonly productServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.userServiceUrl = this.configService.get<string>('app.userServiceUrl')!;
    this.productServiceUrl = this.configService.get<string>(
      'app.productServiceUrl',
    )!;
  }

  async validateUser(
    userId: string,
    correlationId?: string,
  ): Promise<ValidatedUser> {
    try {
      const url = `${this.userServiceUrl}/api/v1/users/${userId}`;
      const { data } = await firstValueFrom(
        this.httpService.get(url, {
          headers: correlationId ? { 'x-correlation-id': correlationId } : {},
          timeout: 5000,
        }),
      );

      if (!data || !data.id) {
        throw new BadRequestException(`User ${userId} not found`);
      }

      return data as ValidatedUser;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error({ userId, error }, 'Failed to validate user');
      throw new BadRequestException(
        `Unable to validate user ${userId}. User service may be unavailable`,
      );
    }
  }

  async validateAddress(
    userId: string,
    addressId: string,
    correlationId?: string,
  ): Promise<ValidatedAddress> {
    try {
      const url = `${this.userServiceUrl}/api/v1/users/${userId}/addresses/${addressId}`;
      const { data } = await firstValueFrom(
        this.httpService.get(url, {
          headers: correlationId ? { 'x-correlation-id': correlationId } : {},
          timeout: 5000,
        }),
      );

      if (!data || !data.id) {
        throw new BadRequestException(
          `Address ${addressId} not found for user ${userId}`,
        );
      }

      return data as ValidatedAddress;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        { userId, addressId, error },
        'Failed to validate address',
      );
      throw new BadRequestException(
        `Unable to validate address ${addressId}. User Service may be unavailable.`,
      );
    }
  }

  async validateAndPriceProducts(
    products: CreateOrderItemDto[],
    correlationId?: string,
  ): Promise<ValidatedOrderItem[]> {
    const productIds = products.map((p) => p.productId);

    try {
      const url = `${this.productServiceUrl}/api/v1/products/exists`;
      const { data: existingData } = await firstValueFrom(
        this.httpService.post(
          url,
          {
            ids: productIds,
          },
          {
            headers: correlationId ? { 'x-correlation-id': correlationId } : {},
            timeout: 5000,
          },
        ),
      );
      if (
        existingData &&
        Array.isArray(existingData.missing) &&
        existingData.missing.length > 0
      ) {
        throw new BadRequestException(
          `Products not found: ${existingData.missing.join(', ')}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        { productIds, error },
        'Failed to validate product existence',
      );
      throw new BadRequestException(
        'Unable to validate products. Product Service may be unavailable.',
      );
    }

    return Promise.all(
      products.map(async (p) => {
        try {
          const url = `${this.productServiceUrl}/api/v1/products/${p.productId}`;
          const { data: productData } = await firstValueFrom(
            this.httpService.get(url, {
              headers: correlationId
                ? { 'x-correlation-id': correlationId }
                : {},
              timeout: 5000,
            }),
          );

          if (!productData || !productData.id) {
            throw new BadRequestException(`Product ${p.productId} not found`);
          }

          const product = productData as ValidatedProduct;

          return {
            ...p,
            validatedPrice: product.price,
            validatedName: product.name,
            validatedSku: p.sku || product.sku,
          };
        } catch (error) {
          if (error instanceof BadRequestException) {
            throw error;
          }
          this.logger.error(
            { productId: p.productId, error },
            'Failed to get product price',
          );
          throw new BadRequestException(
            `Unable to validate product ${p.productId}. Product Service may be unavailable.`,
          );
        }
      }),
    );
  }
}
