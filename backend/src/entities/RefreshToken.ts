import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from "typeorm";
import { User } from "./User";

@Entity("refresh_tokens")
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column()
  userId!: string;

  // We never store the raw refresh token — only a SHA-256 hash of it, so a
  // database leak alone can't be used to forge sessions. Hashing (rather than
  // bcrypt) is deliberate here: it's deterministic, so we can look a token up
  // directly by its hash instead of loading every row and comparing.
  @Column({ unique: true })
  tokenHash!: string;

  @Column()
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
