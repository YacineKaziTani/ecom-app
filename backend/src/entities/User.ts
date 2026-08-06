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

  @Column()
  password!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ type: "varchar", default: "customer" })
  role!: UserRole;

  @OneToMany(() => Order, (order) => order.user)
  orders!: Order[];

  @OneToOne(() => Shop, (shop) => shop.owner)
  shop?: Shop;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
