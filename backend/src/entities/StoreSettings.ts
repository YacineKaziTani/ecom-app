import { Entity, PrimaryColumn, Column, UpdateDateColumn, Check, ManyToOne, JoinColumn } from "typeorm";
import { Shop } from "./Shop";

// The business behind the store, filled in by a super admin in
// Dashboard → Store info: shown on the Contact page, the WhatsApp button and
// the legal pages. A single row (id 1); until it's saved the defaults apply.
@Entity("store_settings")
@Check("CHK_store_settings_single_row", `"id" = 1`)
export class StoreSettings {
  @PrimaryColumn({ type: "int", default: 1, primaryKeyConstraintName: "PK_store_settings_id" })
  id!: number;

  // The shop's public name (navbar, emails, page titles, app name) and logo.
  @Column({ type: "varchar", length: 60, default: "ArtisanShop" })
  brandName!: string;

  @Column({ type: "varchar", length: 2048, nullable: true })
  logoUrl!: string | null;

  // Business or person legally responsible for the store.
  @Column({ type: "varchar", length: 120, nullable: true })
  legalName!: string | null;

  // Commercial register (RC) or artisan card number.
  @Column({ type: "varchar", length: 60, nullable: true })
  registerNumber!: string | null;

  // NIF.
  @Column({ type: "varchar", length: 40, nullable: true })
  taxId!: string | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  address!: string | null;

  // "0XXXXXXXX(X)": a mobile or a landline.
  @Column({ type: "varchar", length: 20, nullable: true })
  phone!: string | null;

  // International digits for wa.me links, e.g. "213550123456".
  @Column({ type: "varchar", length: 20, nullable: true })
  whatsapp!: string | null;

  @Column({ type: "varchar", length: 254, nullable: true })
  email!: string | null;

  // Free text, e.g. "Sat–Thu, 9:00–18:00".
  @Column({ type: "varchar", length: 120, nullable: true })
  openingHours!: string | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  facebookUrl!: string | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  instagramUrl!: string | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  tiktokUrl!: string | null;

  // Usual delivery time, in days, shown in the delivery policy.
  @Column({ type: "int", default: 2 })
  deliveryDaysMin!: number;

  @Column({ type: "int", default: 7 })
  deliveryDaysMax!: number;

  // Days to exchange an item for another reason than a defect (size, colour…);
  // 0 = not offered. Wrong or damaged items are always taken back.
  @Column({ type: "int", default: 7 })
  exchangeDays!: number;

  // Delivery is free when the products total (after any coupon) reaches this
  // amount. Null: never free.
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: { to: (v: number | null) => v, from: (v: string | null) => (v === null ? null : Number(v)) },
  })
  freeShippingThreshold!: number | null;

  // Advertising pixels, loaded only for visitors who accept them.
  @Column({ type: "varchar", length: 20, nullable: true })
  facebookPixelId!: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  tiktokPixelId!: string | null;

  // The artisan shown on the home page (null: the one with the most products).
  @Column({ type: "uuid", nullable: true })
  featuredShopId!: string | null;

  @ManyToOne(() => Shop, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "featuredShopId" })
  featuredShop?: Shop | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
