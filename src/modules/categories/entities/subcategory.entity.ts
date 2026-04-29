import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Category } from './category.entity';

@Entity('subcategories')
@Index(['categoryId', 'name'], { unique: true })
export class Subcategory extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category, (category) => category.subcategories)
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  iconPath: string | null;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
