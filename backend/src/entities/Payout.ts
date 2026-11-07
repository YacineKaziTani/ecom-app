import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from "typeorm";
import { Shop } from "./Shop";
import { User } from "./User";

// Money the platform has paid out to a shop (recorded by a super admin after
// the bank/CCP transfer). A shop's balance = what it earned − its payouts.
@Entity("payouts")
export class Payout {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Shop, { onDelete: "CASCADE" })
  @JoinColumn({ name: "shopId" })
  shop?: Shop;

  @Index("IDX_payouts_shopId")
  @Column()
  shopId!: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount!: number;

  // e.g. the transfer reference, so both sides can reconcile.
  @Column({ type: "varchar", nullable: true })
  reference?: string | null;

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
