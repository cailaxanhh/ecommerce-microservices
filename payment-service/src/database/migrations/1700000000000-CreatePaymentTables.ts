import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentTables1700000000000 implements MigrationInterface {
  name = 'CreatePaymentTables1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "payment_status_enum" AS ENUM (
        'PENDING', 'PROCESSED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE "payment_method_enum" AS ENUM ('CARD', 'BANK_TRANSFER');
    `);
    await queryRunner.query(`
      CREATE TYPE "ledger_entry_type_enum" AS ENUM ('CHARGE', 'REFUND');
    `);
    await queryRunner.query(`
      CREATE TYPE "outbox_event_type_enum" AS ENUM (
        'PaymentSucceeded', 'PaymentFailed', 'RefundIssued'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE "outbox_status_enum" AS ENUM ('PENDING', 'SENT');
    `);

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderId"               VARCHAR(255) NOT NULL,
        "customerUserId"        VARCHAR(255) NOT NULL,
        "amount"                NUMERIC(12,2) NOT NULL,
        "currency"              VARCHAR(3) NOT NULL DEFAULT 'USD',
        "status"                "payment_status_enum" NOT NULL DEFAULT 'PENDING',
        "method"                "payment_method_enum" NOT NULL DEFAULT 'CARD',
        "provider"              VARCHAR(100),
        "providerTransactionId" VARCHAR(255),
        "idempotencyKey"        VARCHAR(255) NOT NULL,
        "refundedAmount"        NUMERIC(12,2) NOT NULL DEFAULT 0,
        "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payments_orderId" UNIQUE ("orderId"),
        CONSTRAINT "UQ_payments_idempotencyKey" UNIQUE ("idempotencyKey")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "ledger_entries" (
        "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "paymentId" UUID NOT NULL,
        "type"      "ledger_entry_type_enum" NOT NULL,
        "amount"    NUMERIC(12,2) NOT NULL,
        "reason"    VARCHAR(500),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_ledger_payment" FOREIGN KEY ("paymentId")
          REFERENCES "payments"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "outbox" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "aggregateId" VARCHAR(255) NOT NULL,
        "eventType"   "outbox_event_type_enum" NOT NULL,
        "eventId"     UUID NOT NULL,
        "payload"     JSONB NOT NULL,
        "headers"     JSONB,
        "status"      "outbox_status_enum" NOT NULL DEFAULT 'PENDING',
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "processedAt" TIMESTAMPTZ
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "processed_events" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId"     VARCHAR(255) NOT NULL,
        "topic"       VARCHAR(100) NOT NULL,
        "partition"   INTEGER NOT NULL,
        "offset"      BIGINT NOT NULL,
        "processedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_processed_events_eventId" UNIQUE ("eventId")
      );
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX "IDX_payments_orderId" ON "payments" ("orderId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_customerUserId" ON "payments" ("customerUserId")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_payments_status" ON "payments" ("status")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_ledger_paymentId" ON "ledger_entries" ("paymentId")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_outbox_status" ON "outbox" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_outbox_createdAt" ON "outbox" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "processed_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "outbox_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "outbox_event_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ledger_entry_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_method_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_status_enum"`);
  }
}
