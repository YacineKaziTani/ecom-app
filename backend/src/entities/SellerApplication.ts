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

export type ApplicationStatus = "pending" | "approved" | "rejected";

// A customer asking to open a shop. Approving it creates the shop and makes
// the applicant its admin (routes/sellerApplications.ts).
@Entity("seller_applications")
export class SellerApplication {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: User;

  @Index("IDX_seller_applications_userId")
  @Column()
  userId!: string;

  @Column()
  shopName!: string;

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @Column()
  phone!: string;

  @Column({ type: "int", nullable: true })
  wilayaCode?: number | null;

  // What they make / why they want to sell.
  @Column({ type: "text", nullable: true })
  message?: string | null;

  @Index("IDX_seller_applications_status")
  @Column({ type: "varchar", default: "pending" })
  status!: ApplicationStatus;

  @Column({ type: "varchar", nullable: true })
  reviewNote?: string | null;

  @Column({ type: "uuid", nullable: true })
  reviewedById?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  reviewedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
