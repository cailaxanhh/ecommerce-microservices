import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Payment } from './payment.entity.js';

export enum LedgerEntryType {
  CHARGE = 'CHARGE',
  REFUND = 'REFUND',
}

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  paymentId!: string;

  @ManyToOne(() => Payment, (payment) => payment.ledgerEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'paymentId' })
  payment!: Payment;

  @Column({ type: 'enum', enum: LedgerEntryType })
  type!: LedgerEntryType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
