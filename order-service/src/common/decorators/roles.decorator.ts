import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type AppRole = 'customer' | 'staff' | 'admin';

export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
