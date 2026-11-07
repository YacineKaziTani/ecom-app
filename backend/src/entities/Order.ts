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
import { Shipment } from "./Shipment";

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "failed";
// card = online via Chargily; cod = cash paid to the courier on delivery.
export type PaymentMethod = "card" | "cod";
// home = delivered to the door; desk = picked up at the carrier's office.
export type DeliveryType = "home" | "desk";

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

  @Column({ type: "varchar", default: "card" })
  paymentMethod!: PaymentMethod;

  @Column({ nullable: true })
  paymentProvider?: string;

  @Column({ nullable: true, unique: true })
  paymentCheckoutId?: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  subtotal!: number;

  @Column({ nullable: true })
  couponCode?: string;

  // Set when the coupon belonged to a shop: that shop absorbs the discount in
  // its payout balance (a platform-wide coupon is absorbed by the platform).
  @Column({ type: "uuid", nullable: true })
  couponShopId?: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  discountAmount!: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  shippingFee!: number;

  // subtotal − discountAmount + shippingFee: what the customer pays.
  @Column({ type: "decimal", precision: 10, scale: 2 })
  total!: number;

  // Street / building / landmark details.
  @Column()
  shippingAddress!: string;

  // Delivery details (nullable only for orders placed before they existed).
  // wilayaName is a snapshot so old orders keep reading correctly.
  @Column({ type: "int", nullable: true })
  wilayaCode?: number | null;

  @Column({ type: "varchar", nullable: true })
  wilayaName?: string | null;

  @Column({ type: "varchar", nullable: true })
  commune?: string | null;

  @Column({ type: "varchar", nullable: true })
  phone?: string | null;

  @Column({ type: "varchar", nullable: true })
  deliveryType?: DeliveryType | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  @OneToMany(() => Shipment, (shipment) => shipment.order)
  shipments?: Shipment[];

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
