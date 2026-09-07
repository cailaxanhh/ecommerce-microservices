import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { User } from './user.entity.js';
import { AddressType } from './address-type.enum.js';

@Entity('addresses')
export class Address {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 255, name: 'line1' })
  line1!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'line2' })
  line2!: string | null;

  @Column({ type: 'varchar', length: 128 })
  city!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  state!: string | null;

  @Column({ type: 'varchar', length: 128 })
  country!: string;

  @Column({ type: 'varchar', length: 16, name: 'postal_code' })
  postalCode!: string;

  @Column({
    type: 'enum',
    enum: AddressType,
    default: AddressType.HOME,
  })
  type!: AddressType;

  @Column({ type: 'boolean', default: false, name: 'is_default' })
  isDefault!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne('User', 'addresses', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}