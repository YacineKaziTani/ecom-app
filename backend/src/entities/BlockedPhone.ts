import { Entity, PrimaryColumn, Column, CreateDateColumn } from "typeorm";

// Phone numbers that can't use pay on delivery (repeated refusals, fake
// orders…). They can still pay online.
@Entity("blocked_phones")
export class BlockedPhone {
  // Normalised "0XXXXXXXXX" (see algerianPhoneSchema).
  @PrimaryColumn({ type: "varchar", primaryKeyConstraintName: "PK_blocked_phones_phone" })
  phone!: string;

  @Column({ type: "varchar", nullable: true })
  reason?: string | null;

  @Column({ type: "uuid", nullable: true })
  createdById?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
