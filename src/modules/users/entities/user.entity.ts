import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Role } from '@common/enums/role.enum';

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Public-facing handle. Stored as-typed for display; uniqueness is enforced
  // case-insensitively in the service layer (LOWER(username) lookups), backed by
  // the case-sensitive DB unique constraint declared here. See username.validator.ts.
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

  @Column({ type: 'timestamptz', nullable: true, default: null })
  usernameChangedAt: Date | null;
}
