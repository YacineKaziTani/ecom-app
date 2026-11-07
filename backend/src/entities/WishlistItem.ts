import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
} from "typeorm";
import { Product } from "./Product";
import { User } from "./User";

@Entity("wishlist_items")
@Unique("UQ_wishlist_user_product", ["userId", "productId"])
export class WishlistItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: User;

  @Column()
  userId!: string;

  @ManyToOne(() => Product, { onDelete: "CASCADE" })
  @JoinColumn({ name: "productId" })
  product?: Product;

  @Index("IDX_wishlist_items_productId")
  @Column()
  productId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
