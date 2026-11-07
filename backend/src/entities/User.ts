import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne } from "typeorm";
import { Order } from "./Order";
import { Shop } from "./Shop";

export type UserRole = "super_admin" | "admin" | "customer";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  email!: string;

  // Never loaded unless explicitly selected (see the login route), so the hash
  // can't leak through relations like order.user.
  @Column({ select: false })
  password!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  address?: string;

  // Saved delivery location, used to pre-fill checkout.
  @Column({ type: "int", nullable: true })
  wilayaCode?: number | null;

  @Column({ type: "varchar", nullable: true })
  commune?: string | null;

  @Column({ type: "varchar", default: "customer" })
  role!: UserRole;

  // null until the user clicks the link in the verification email.
  @Column({ type: "timestamptz", nullable: true })
  emailVerifiedAt?: Date | null;

  // Two-factor sign-in (TOTP, for admins). The secret is stored encrypted and,
  // like the recovery-code hashes, never loaded unless explicitly selected.
  @Column({ type: "varchar", nullable: true, select: false })
  totpSecret?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  totpEnabledAt?: Date | null;

  @Column({ type: "text", array: true, nullable: true, select: false })
  totpRecoveryCodes?: string[] | null;

  // Last accepted 30-second step, so a code can't be replayed.
  @Column({ type: "int", nullable: true, select: false })
  totpLastUsedStep?: number | null;

  @OneToMany(() => Order, (order) => order.user)
  orders!: Order[];

  @OneToOne(() => Shop, (shop) => shop.owner)
  shop?: Shop;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
