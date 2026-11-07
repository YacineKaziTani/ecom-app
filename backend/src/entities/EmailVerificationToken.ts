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

// Same pattern as password reset tokens: only the SHA-256 of the emailed
// token is stored.
@Entity("email_verification_tokens")
export class EmailVerificationToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Index("IDX_email_verification_tokens_userId")
  @Column()
  userId!: string;

  @Column({ unique: true })
  tokenHash!: string;

  @Column({ type: "timestamptz" })
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
