import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('processed_events')
@Index(['eventId', 'eventType'], { unique: true })
export class ProcessedEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  eventId!: string;

  @Column({ type: 'varchar', length: 128 })
  eventType!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  correlationId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  processedAt!: Date;
}
