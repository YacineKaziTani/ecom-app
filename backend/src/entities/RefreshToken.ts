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

@Entity("refresh_tokens")
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Index("IDX_refresh_tokens_userId")
  @Column()
  userId!: string;

  @Column({ unique: true })
  tokenHash!: string;

  @Column({ type: "timestamptz" })
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
