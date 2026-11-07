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
import { User } from "./User";
import { OrderItem } from "./OrderItem";

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "failed";

@Entity("orders")
// Partial index for the reservation-expiry job (see migration AddIndexes).
// synchronize:false — TypeORM can't diff partial-index predicates reliably.
@Index("IDX_orders_reservation", { synchronize: false })
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, (user) => user.orders, {
    onDelete: "SET NULL",
    nullable: true,
  })
  @JoinColumn({ name: "userId" })
  user?: User;

  @Index("IDX_orders_userId")
  @Column({ nullable: true })
  userId?: string;

  @Column({ nullable: true })
  guestEmail?: string;

  @Column({ nullable: true })
  guestName?: string;

  @Column({ type: "varchar", default: "pending" })
  status!: OrderStatus;

  @Column({ type: "varchar", default: "unpaid" })
  paymentStatus!: PaymentStatus;

  @Column({ nullable: true })
  paymentProvider?: string;

  @Column({ nullable: true, unique: true })
  paymentCheckoutId?: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  subtotal!: number;

  @Column({ nullable: true })
  couponCode?: string;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  discountAmount!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  total!: number;

  @Column()
  shippingAddress!: string;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  @Column({ nullable: true, unique: true })
  idempotencyKey?: string;

  // An unpaid order holds its stock only until this moment; after that the
  // expiry job (services/orderLifecycle.ts) cancels it and releases the stock.
  // null = no deadline (paid, cancelled, or placed before this existed).
  @Column({ type: "timestamptz", nullable: true })
  reservedUntil?: Date | null;

  @Index("IDX_orders_createdAt")
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
