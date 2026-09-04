import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum NotificationKind {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Entity('notification_deliveries')
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: NotificationKind })
  kind!: NotificationKind;

  @Column({ type: 'varchar', length: 320 })
  recipient!: string;

  @Column({ type: 'varchar', length: 64 })
  channel!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  subject!: string | null;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.PENDING })
  status!: NotificationStatus;

  @Column({ type: 'varchar', length: 256, nullable: true })
  providerToken!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  eventId!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  eventType!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  correlationId!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
