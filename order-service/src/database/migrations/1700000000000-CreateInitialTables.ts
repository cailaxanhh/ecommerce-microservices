import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialTables1700000000000 implements MigrationInterface {
  name = 'CreateInitialTables1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE order_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE outbox_status_enum AS ENUM ('PENDING', 'SENT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number VARCHAR(50) NOT NULL UNIQUE,
        customer_user_id UUID NOT NULL,
        status order_status_enum NOT NULL DEFAULT 'PENDING',
        shipping_address_id UUID,
        shipping_address_json JSONB,
        total_amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'USD',
        payment_method VARCHAR(100),
        correlation_id UUID,
        version INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_customer_user_id
        ON orders (customer_user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_status
        ON orders (status);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_created_at
        ON orders (created_at DESC);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID NOT NULL,
        sku VARCHAR(100),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price DECIMAL(10, 2) NOT NULL,
        line_total DECIMAL(12, 2) NOT NULL,
        name VARCHAR(255)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id
        ON order_items (order_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_order_items_product_id
        ON order_items (product_id);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS outbox (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        aggregate_id UUID NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        event_id UUID NOT NULL UNIQUE,
        payload JSONB NOT NULL,
        headers JSONB,
        status outbox_status_enum NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_outbox_status_created_at
        ON outbox (status, created_at ASC)
        WHERE status = 'PENDING';
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_outbox_aggregate_id
        ON outbox (aggregate_id);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS processed_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL UNIQUE,
        event_type VARCHAR(100) NOT NULL,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_processed_events_expires_at
        ON processed_events (expires_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS processed_events;`);
    await queryRunner.query(`DROP TABLE IF EXISTS outbox;`);
    await queryRunner.query(`DROP TABLE IF EXISTS order_items;`);
    await queryRunner.query(`DROP TABLE IF EXISTS orders;`);
    await queryRunner.query(`DROP TYPE IF EXISTS outbox_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS order_status_enum;`);
  }
}
