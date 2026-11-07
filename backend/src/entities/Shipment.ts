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
import { Order, OrderStatus } from "./Order";
import { Shop } from "./Shop";

// One per shop per order: each shop fulfils (and tracks) its own part of a
// multi-shop order. The order's own status is the roll-up of its shipments —
// see services/fulfilment.ts.
@Entity("shipments")
@Unique("UQ_shipments_order_shop", ["orderId", "shopId"])
export class Shipment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Order, (order) => order.shipments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order!: Order;

  @Column()
  orderId!: string;

  @ManyToOne(() => Shop, { onDelete: "CASCADE" })
  @JoinColumn({ name: "shopId" })
  shop?: Shop;

  @Index("IDX_shipments_shopId")
  @Column()
  shopId!: string;

  @Column({ type: "varchar", default: "pending" })
  status!: OrderStatus;

  @Column({ type: "varchar", nullable: true })
  carrier?: string | null;

  @Column({ type: "varchar", nullable: true })
  trackingNumber?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
