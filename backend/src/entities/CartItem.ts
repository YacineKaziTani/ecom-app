import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { User } from "./User";
import { Product } from "./Product";
import { ProductVariant } from "./ProductVariant";

@Entity("cart_items")
// One line per user + product + variant. A unique index with NULLS NOT
// DISTINCT (migration AddProductVariants) — TypeORM can't express that, so
// it's excluded from schema sync.
@Index("UQ_cart_items_line", { synchronize: false })
export class CartItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column()
  userId!: string;

  @ManyToOne(() => Product, { onDelete: "CASCADE" })
  @JoinColumn({ name: "productId" })
  product!: Product;

  @Index("IDX_cart_items_productId")
  @Column()
  productId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "variantId" })
  variant?: ProductVariant | null;

  @Column({ type: "uuid", nullable: true })
  variantId?: string | null;

  @Column({ default: 1 })
  quantity!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
