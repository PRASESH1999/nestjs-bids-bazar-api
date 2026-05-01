import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_images')
@Unique(['productId', 'displayOrder'])
export class ProductImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'varchar' })
  filePath: string;

  @Column({ type: 'varchar' })
  originalFilename: string;

  @Column({ type: 'varchar' })
  mimeType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  // 0 = primary/thumbnail, then 1, 2, …
  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
