import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { ListNotificationsDto } from './dto/list-notifications.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @Roles('staff', 'admin')
  async findAll(@Query() query: ListNotificationsDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles('staff', 'admin')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('staff', 'admin')
  async create(@Body() dto: CreateNotificationDto) {
    return this.service.createAndDispatch(dto);
  }
}
