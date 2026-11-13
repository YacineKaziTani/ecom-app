import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

// A slide of the home page banner, managed by a super admin in
// Dashboard → Home page. Shown in `position` order; `lang` limits a slide to
// one storefront language (null: every language).
@Entity("home_banners")
export class HomeBanner {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 2048 })
  imageUrl!: string;

  @Column({ type: "varchar", length: 120 })
  title!: string;

  @Column({ type: "varchar", length: 240, nullable: true })
  subtitle!: string | null;

  // Button text and where it goes ("/shops", "/?category=…", or https://…).
  @Column({ type: "varchar", length: 40, nullable: true })
  ctaLabel!: string | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  link!: string | null;

  @Column({ type: "varchar", length: 2, nullable: true })
  lang!: string | null;

  @Column({ type: "int", default: 0 })
  position!: number;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
