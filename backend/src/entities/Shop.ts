import { Entity, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "./User";
import { Product } from "./Product";

@Entity("shops")
export class Shop {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "varchar", nullable: true })
  logoUrl?: string | null;

  // Shop page profile: a wide cover photo, the artisan's story, where the
  // workshop is, and its social pages.
  @Column({ type: "varchar", length: 2048, nullable: true })
  coverUrl?: string | null;

  @Column({ type: "text", nullable: true })
  story?: string | null;

  @Column({ type: "int", nullable: true })
  wilayaCode?: number | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  instagramUrl?: string | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  facebookUrl?: string | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  tiktokUrl?: string | null;

  @OneToOne(() => User, (user) => user.shop, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ownerId" })
  owner!: User;

  @Column()
  ownerId!: string;

  @OneToMany(() => Product, (product) => product.shop)
  products!: Product[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
