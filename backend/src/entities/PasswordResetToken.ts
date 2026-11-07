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

@Entity("password_reset_tokens")
export class PasswordResetToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Index("IDX_password_reset_tokens_userId")
  @Column()
  userId!: string;

  @Column({ unique: true })
  tokenHash!: string;

  @Column({ type: "timestamptz" })
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
