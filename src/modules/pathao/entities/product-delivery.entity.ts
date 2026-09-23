import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { ProductPayment } from '@modules/payments/entities/product-payment.entity';

/**
 * Everything about actually getting a **paid-for** sale to the buyer:
 * the frozen recipient/address snapshot, what the buyer was charged for
 * delivery, warehouse receipt, the Pathao courier order, and its live status.
 *
 * One row per successful sale — created the moment `PAYMENT_SUCCEEDED` fires
 * (see ProductDeliveriesService), never before. Deliberately separate from
 * `ProductPayment`, which stays purely about the gateway transaction: every
 * payment *attempt* (including failed/expired retries) would otherwise carry
 * a full address snapshot even though only a successful one ever ships.
 *
 * Named after the domain concept, not the courier vendor — swapping or
 * adding couriers later shouldn't imply a table rename.
 */
@Entity('product_deliveries')
export class ProductDelivery extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  productPaymentId: string;

  @ManyToOne(() => ProductPayment, {
    onDelete: 'RESTRICT',
    nullable: false,
    eager: false,
  })
  @JoinColumn({ name: 'productPaymentId' })
  productPayment: ProductPayment;

  // ─── Recipient/address, frozen at the moment payment succeeded ────────────
  // A buyer editing or deleting the saved address afterward must never
  // rewrite where an already-paid parcel is going — this is the permanent
  // record of truth for fulfilment, resolved once from ShippingAddress.

  @Column({ type: 'varchar', length: 150 })
  recipientName: string;

  @Column({ type: 'varchar', length: 20 })
  recipientPhone: string;

  @Column({ type: 'varchar', length: 100 })
  province: string;

  @Column({ type: 'varchar', length: 100 })
  district: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 255 })
  street: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  wardNumber: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  landmark: string | null;

  // Pathao's own location ids — what's actually sent on the create-order call.
  @Column({ type: 'int' })
  pathaoCityId: number;

  @Column({ type: 'varchar', nullable: true })
  pathaoCityName: string | null;

  @Column({ type: 'int' })
  pathaoZoneId: number;

  @Column({ type: 'varchar', nullable: true })
  pathaoZoneName: string | null;

  @Column({ type: 'int', nullable: true })
  pathaoAreaId: number | null;

  @Column({ type: 'varchar', nullable: true })
  pathaoAreaName: string | null;

  // ─── What the buyer paid for delivery ──────────────────────────────────────

  // Snapshotted from DELIVERY_CHARGE_FLAT at the moment payment succeeded —
  // immune to a later config change, same reasoning as ProductPayment's
  // paymentDeadline. Bundled into the Fonepay QR amount at checkout, not
  // collected separately.
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  deliveryCharge: number;

  // ─── Warehouse checkpoint ───────────────────────────────────────────────────
  // Gates dispatch — Pathao is never asked to collect something that isn't
  // physically with us yet. Mirrors the sellerPaidAt/sellerPaidById
  // nullable-timestamp-as-milestone idiom already used on ProductPayment.

  @Column({ type: 'timestamptz', nullable: true })
  receivedAtWarehouseAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  receivedAtWarehouseById: string | null;

  // ─── The Pathao order (filled in at dispatch) ──────────────────────────────

  // Snapshotted PATHAO_STORE_ID at dispatch time, immune to later env changes.
  @Column({ type: 'int', nullable: true })
  storeId: number | null;

  @Index({ unique: true, where: '"consignmentId" IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  consignmentId: string | null;

  // Entered by admin when they weigh the parcel at dispatch time — items are
  // auctioned goods of unknown weight until physically at the warehouse.
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  itemWeightKg: number | null;

  @Column({ type: 'varchar', nullable: true })
  itemDescription: string | null;

  // Always 0 — everything is prepaid via Fonepay now, nothing left for the
  // rider to collect on delivery.
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amountToCollect: number;

  // Pathao's own quoted/actual delivery fee — separate from `deliveryCharge`
  // above (what the buyer paid). Comparing the two gives cost-vs-charge
  // tracking per delivery for free, just by reading one row.
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  pathaoDeliveryFee: number | null;

  @Column({ type: 'uuid', nullable: true })
  dispatchedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  dispatchedAt: Date | null;

  // ─── Live tracking ──────────────────────────────────────────────────────────

  // Raw status string from Pathao, refreshed by ProductDeliveriesCron — kept
  // untyped since the real status vocabulary isn't confirmed from sandbox yet.
  @Column({ type: 'varchar', nullable: true })
  orderStatus: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastStatusCheckAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;
}
