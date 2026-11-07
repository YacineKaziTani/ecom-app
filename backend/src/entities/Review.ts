import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from "typeorm";
import { Product } from "./Product";
import { User } from "./User";

// One review per customer per product, only from verified buyers (see
// routes/reviews.ts). Product.ratingAverage / ratingCount are kept in sync.
@Entity("reviews")
@Unique("UQ_reviews_product_user", ["productId", "userId"])
export class Review {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Product, { onDelete: "CASCADE" })
  @JoinColumn({ name: "productId" })
  product?: Product;

  @Index("IDX_reviews_productId")
  @Column()
  productId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: User;

  @Column()
  userId!: string;

  @Column({ type: "int" })
  rating!: number; // 1–5

  @Column({ type: "text", nullable: true })
  comment?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
