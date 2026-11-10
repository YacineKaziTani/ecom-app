import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from "typeorm";
import { Order } from "./Order";
import { User } from "./User";

// confirmed     → the customer wants it: order moves to "processing"
// no_answer     → try again later (Order.callAttempts counts these)
// declined      → the customer doesn't want it anymore: order cancelled
// wrong_number  → fake or mistyped order: order cancelled
export type CallOutcome = "confirmed" | "no_answer" | "declined" | "wrong_number";

// One phone call made to confirm a pay-on-delivery order.
@Entity("order_calls")
export class OrderCall {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Order, (order) => order.calls, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order?: Order;

  @Index("IDX_order_calls_orderId")
  @Column()
  orderId!: string;

  @Column({ type: "varchar" })
  outcome!: CallOutcome;

  @Column({ type: "varchar", nullable: true })
  note?: string | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "createdById" })
  createdBy?: User | null;

  @Column({ type: "uuid", nullable: true })
  createdById?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
