import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from "typeorm";
import { Product } from "./Product";

// One purchasable option of a product ("M", "Bleu / L", "500 g"), with its
// own stock and optionally its own price. When a product has variants, its
// Product.stock is the sum of theirs (services/inventory.ts keeps it in sync).
@Entity("product_variants")
@Unique("UQ_product_variants_product_name", ["productId", "name"])
export class ProductVariant {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Product, (product) => product.variants, { onDelete: "CASCADE" })
  @JoinColumn({ name: "productId" })
  product?: Product;

  @Index("IDX_product_variants_productId")
  @Column()
  productId!: string;

  @Column()
  name!: string;

  @Column({ type: "varchar", nullable: true })
  sku?: string | null;

  // null = same price as the product.
  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  price?: number | null;

  @Column({ type: "int", default: 0 })
  stock!: number;

  // Display order on the product page.
  @Column({ type: "int", default: 0 })
  position!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
