import { SetMetadata } from '@nestjs/common';

export const POLICY_KEY = 'policy_key';

export interface PolicyMetadata {
  action: string;
}

export const Policy = (action: string) =>
  SetMetadata(POLICY_KEY, { action } as PolicyMetadata);
