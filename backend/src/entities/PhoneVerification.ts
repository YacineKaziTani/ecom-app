import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm";

// A one-time SMS code sent to confirm a phone number at checkout (optional —
// only when SMS is configured and the order is above COD_OTP_MIN_TOTAL).
@Entity("phone_verifications")
export class PhoneVerification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("IDX_phone_verifications_phone")
  @Column()
  phone!: string;

  @Column()
  codeHash!: string;

  @Column({ type: "timestamptz" })
  expiresAt!: Date;

  // Wrong guesses; the code is dead after MAX_ATTEMPTS.
  @Column({ type: "int", default: 0 })
  attempts!: number;

  // Set when the code is used for an order (single use).
  @Column({ type: "timestamptz", nullable: true })
  usedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
