import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { ProductService } from '../../application/product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { CheckExistenceDto } from './dto/check-existence.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/auth/roles.guard';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Public()
  @Get()
  async list(@Query() query: ListProductsQueryDto) {
    const result = await this.productService.list({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      category: query.category,
      search: query.search,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
    });

    return {
      data: result.data.map(ProductResponseDto.fromEntity),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const product = await this.productService.findById(id);
    return ProductResponseDto.fromEntity(product);
  }

  @Roles('admin')
  @Post()
  async create(@Body() dto: CreateProductDto) {
    const product = await this.productService.create(dto);
    return ProductResponseDto.fromEntity(product);
  }

  @Roles('admin')
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const product = await this.productService.update(id, dto);
    return ProductResponseDto.fromEntity(product);
  }

  @Public()
  @Get(':id/price')
  async findPrice(@Param('id', ParseUUIDPipe) id: string) {
    return this.productService.findPriceById(id);
  }

  @Public()
  @Post('exists')
  async checkExistence(@Body() dto: CheckExistenceDto) {
    return this.productService.checkExistence({
      ids: dto.ids,
      skus: dto.skus,
    });
  }
}
