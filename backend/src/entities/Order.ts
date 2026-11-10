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
import type { Locale } from "../emails/i18n";
import { User } from "./User";
import { OrderItem } from "./OrderItem";
import { Shipment } from "./Shipment";
import { OrderCall } from "./OrderCall";

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  // The parcel came back: refused at the door, unreachable customer, or
  // returned after delivery. Restocks like a cancellation.
  | "returned";

// Statuses where the sale didn't happen: stock is back on the shelf and the
// order counts toward neither revenue nor payouts.
export const CLOSED_STATUSES: readonly OrderStatus[] = ["cancelled", "returned"];
// SQL predicate for "this sale counts" (paid, not closed) — revenue, payouts,
// analytics, verified-buyer reviews. Expects the orders table aliased as `o`.
export const COUNTED_SALE_SQL = `o."paymentStatus" = 'paid' AND o.status NOT IN (${CLOSED_STATUSES.map((s) => `'${s}'`).join(", ")})`;
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

  // Pay-on-delivery confirmation by phone (see OrderCall).
  @Column({ type: "timestamptz", nullable: true })
  confirmedAt?: Date | null;

  // Unanswered confirmation calls so far.
  @Column({ type: "int", default: 0 })
  callAttempts!: number;

  // Set when the order is marked "returned".
  @Column({ type: "timestamptz", nullable: true })
  returnedAt?: Date | null;

  @Column({ type: "varchar", nullable: true })
  returnReason?: string | null;

  // What the courier charged to bring the parcel back (for reporting).
  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  returnCost!: number;

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

  @OneToMany(() => OrderCall, (call) => call.order)
  calls?: OrderCall[];

  @Column({ nullable: true, unique: true })
  idempotencyKey?: string;

  // Language the customer ordered in; every email about this order uses it.
  @Column({ type: "varchar", length: 2, default: "en" })
  locale!: Locale;

  // "customer" when the customer cancelled it themselves (before it shipped).
  @Column({ type: "varchar", nullable: true })
  cancelledBy?: "customer" | null;

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
