import { Entity, PrimaryColumn, Column, UpdateDateColumn } from "typeorm";

// One row per wilaya (seeded by migration AddDeliveryAndCod). Prices are set
// by a super admin in Dashboard → Shipping; 0 means free delivery.
@Entity("shipping_zones")
export class ShippingZone {
  // Official wilaya code (1–58).
  @PrimaryColumn({ type: "int", primaryKeyConstraintName: "PK_shipping_zones_code" })
  code!: number;

  @Column()
  name!: string;

  @Column()
  nameAr!: string;

  // Delivery to the customer's door.
  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  homePrice!: number;

  // Pick-up at the carrier's office ("stop desk"); null = not offered here.
  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  deskPrice?: number | null;

  // Inactive zones can't be selected at checkout.
  @Column({ default: true })
  isActive!: boolean;

  @UpdateDateColumn()
  updatedAt!: Date;
}
