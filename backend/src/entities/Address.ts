import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { User } from "./User";

// A saved delivery address ("Maison", "Travail", "Chez mes parents"), picked
// at checkout to fill the delivery form. One per user can be the default.
@Entity("addresses")
export class Address {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: User;

  @Index("IDX_addresses_userId")
  @Column()
  userId!: string;

  @Column({ type: "varchar", length: 40 })
  label!: string;

  @Column({ type: "varchar", length: 20 })
  phone!: string;

  @Column({ type: "int" })
  wilayaCode!: number;

  @Column({ type: "varchar", length: 100 })
  commune!: string;

  // Street / building / landmark details.
  @Column({ type: "varchar", length: 500 })
  address!: string;

  @Column({ default: false })
  isDefault!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
