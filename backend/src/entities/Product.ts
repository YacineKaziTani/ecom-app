import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from "typeorm";
import { Category } from "./Category";
import { OrderItem } from "./OrderItem";
import { Shop } from "./Shop";

@Entity("products")
// Trigram indexes so the storefront's ILIKE '%term%' search doesn't scan the
// whole table (see migration AddIndexes); TypeORM can't express gin_trgm_ops.
@Index("IDX_products_name_trgm", { synchronize: false })
@Index("IDX_products_description_trgm", { synchronize: false })
export class Product {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Shop, (shop) => shop.products, { onDelete: "CASCADE" })
  @JoinColumn({ name: "shopId" })
  shop!: Shop;

  @Index("IDX_products_shopId")
  @Column()
  shopId!: string;

  @Column()
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price!: number;

  @Column({ default: 0 })
  stock!: number;

  @Column({ type: "varchar", nullable: true })
  imageUrl?: string | null;

  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: "SET NULL",
    nullable: true,
  })
  @JoinColumn({ name: "categoryId" })
  category?: Category;

  @Index("IDX_products_categoryId")
  @Column({ type: "uuid", nullable: true })
  categoryId?: string | null;

  @OneToMany(() => OrderItem, (item) => item.product)
  orderItems!: OrderItem[];

  @Index("IDX_products_createdAt")
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
