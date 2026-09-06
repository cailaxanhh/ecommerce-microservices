import 'dotenv/config';
import { DataSource } from 'typeorm';
import ormConfig from './typeorm.config.js';

/**
 * Standalone data-source for TypeORM CLI (migrations, etc.)
 * Usage: ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js -d src/config/data-source.ts
 */
const dataSource = new DataSource({
  ...(ormConfig as any),
});

export default dataSource;
