import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('processed_events')
export class ProcessedEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  eventId!: string;

  @Column({ type: 'varchar', length: 100 })
  topic!: string;

  @Column({ type: 'varchar', length: 100 })
  partition!: number;

  @Column({ type: 'bigint' })
  offset!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  processedAt!: Date;
}
