import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum OutboxEventType {
  PAYMENT_SUCCEEDED = 'PaymentSucceeded',
  PAYMENT_FAILED = 'PaymentFailed',
  REFUND_ISSUED = 'RefundIssued',
}

export enum OutboxStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
}

@Entity('outbox')
export class Outbox {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  aggregateId!: string;

  @Column({ type: 'enum', enum: OutboxEventType })
  eventType!: OutboxEventType;

  @Column({ type: 'uuid' })
  eventId!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  headers!: Record<string, string> | null;

  @Column({ type: 'enum', enum: OutboxStatus, default: OutboxStatus.PENDING })
  status!: OutboxStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt!: Date | null;
}
