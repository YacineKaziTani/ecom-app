import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Order } from "./Order";
import { Product } from "./Product";
import { ProductVariant } from "./ProductVariant";

@Entity("order_items")
export class OrderItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order!: Order;

  @Index("IDX_order_items_orderId")
  @Column()
  orderId!: string;

  @ManyToOne(() => Product, (product) => product.orderItems, {
    onDelete: "SET NULL",
    nullable: true,
  })
  @JoinColumn({ name: "productId" })
  product?: Product;

  @Column({ nullable: true })
  productId?: string;

  @Index("IDX_order_items_shopId")
  @Column({ nullable: true })
  shopId?: string;

  @Column()
  productName!: string;

  // The option bought, if the product has variants (name kept as a snapshot).
  @ManyToOne(() => ProductVariant, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "variantId" })
  variant?: ProductVariant | null;

  @Column({ type: "uuid", nullable: true })
  variantId?: string | null;

  @Column({ type: "varchar", nullable: true })
  variantName?: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price!: number;

  @Column()
  quantity!: number;

  // Platform commission (%) at the time of purchase, so changing the rate
  // later never rewrites what a shop already earned.
  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  commissionRate!: number;
}
