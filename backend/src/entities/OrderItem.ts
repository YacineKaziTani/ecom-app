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

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price!: number;

  @Column()
  quantity!: number;
}
