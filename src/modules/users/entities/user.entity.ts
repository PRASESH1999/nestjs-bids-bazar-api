import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Role } from '@common/enums/role.enum';

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // System-generated public handle (e.g. BB000001-2026) assigned via the
  // `username_seq` Postgres sequence at account-creation time. Never typed by
  // a user or an admin. Backed by a DB unique constraint as a safety net.
  @Column({ type: 'varchar', length: 30, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role: Role;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', nullable: true })
  hashedRefreshToken: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  nameChangedAt: Date | null;
}
