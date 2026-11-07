import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from "typeorm";
import { User } from "./User";

// Who did what in the dashboard: role changes, order/shipment updates, coupon,
// shipping and payout changes, seller decisions, 2FA changes…
@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "actorId" })
  actor?: User | null;

  @Column({ type: "uuid", nullable: true })
  actorId?: string | null;

  // Snapshot, so the entry stays readable if the account is deleted.
  @Column({ type: "varchar", nullable: true })
  actorEmail?: string | null;

  @Index("IDX_audit_logs_action")
  @Column()
  action!: string;

  @Column()
  entityType!: string;

  @Column({ type: "varchar", nullable: true })
  entityId?: string | null;

  @Column({ type: "jsonb", nullable: true })
  details?: Record<string, unknown> | null;

  @Column({ type: "varchar", nullable: true })
  ip?: string | null;

  @Index("IDX_audit_logs_createdAt")
  @CreateDateColumn()
  createdAt!: Date;
}
