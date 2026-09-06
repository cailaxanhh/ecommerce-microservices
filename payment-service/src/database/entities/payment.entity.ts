import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { LedgerEntry } from './ledger-entry.entity.js';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

export enum PaymentMethod {
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  orderId!: string;

  @Column({ type: 'varchar', length: 255 })
  customerUserId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CARD })
  method!: PaymentMethod;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provider!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerTransactionId!: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  idempotencyKey!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  refundedAmount!: number;

  @OneToMany(() => LedgerEntry, (entry) => entry.payment, { cascade: true })
  ledgerEntries!: LedgerEntry[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
