import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Subcategory } from './subcategory.entity';

@Entity('categories')
export class Category extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  iconPath: string | null;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Subcategory, (subcategory) => subcategory.category)
  subcategories: Subcategory[];
}
