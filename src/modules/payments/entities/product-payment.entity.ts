import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { DeliveryZone } from '@common/enums/delivery-zone.enum';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';
import { ProductSettlement } from '@modules/bidding/entities/product-settlement.entity';
import { ShippingAddress } from '@modules/shipping/entities/shipping-address.entity';

/** What the parcel was addressed to, frozen at payment time. */
export interface ShippingAddressSnapshot {
  label: string;
  recipientName: string;
  recipientPhone: string;
  province: string;
  district: string;
  city: string;
  street: string;
  wardNumber: string | null;
  landmark: string | null;
}

@Entity('product_payments')
@Index(['productId', 'status'])
@Index(['winnerUserId', 'status'])
// Partial unique index: at most one PENDING (in-flight QR attempt) per
// settlement round at a time — scoped to the round, not the product, so a
// new round's payment attempt is never blocked by a prior round's row that
// hasn't been cron-expired yet.
@Index(['productSettlementId'], {
  where: `"status" = 'PENDING'`,
  unique: true,
})
export class ProductPayment extends BaseEntity {
  // ─── Product, settlement round & winner ────────────────────────────────────

  @Index()
  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, {
    onDelete: 'RESTRICT',
    nullable: false,
    eager: false,
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  // The settlement round (fallback rank) this payment attempt belongs to.
  // Used to verify a gateway confirmation still matches the currently-active
  // round before settling — see AuctionLifecycleService.confirmPaymentGateway.
  @Index()
  @Column({ type: 'uuid' })
  productSettlementId: string;

  @ManyToOne(() => ProductSettlement, {
    onDelete: 'RESTRICT',
    nullable: false,
    eager: false,
  })
  @JoinColumn({ name: 'productSettlementId' })
  productSettlement: ProductSettlement;

  @Column({ type: 'uuid' })
  sellerId: string;

  // Denormalized from product.ownerId at initiation time — avoids a join for
  // admin payment-records views.
  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Index()
  @Column({ type: 'uuid' })
  winnerUserId: string;

  // The bidder who is payment-responsible for this specific attempt.
  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'winnerUserId' })
  winner: User;

  // ─── Amount ───────────────────────────────────────────────────────────────

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  // ─── Delivery destination ─────────────────────────────────────────────────

  /*
   * The saved address the buyer picked at checkout, and a **snapshot** of it.
   *
   * Both, on purpose. The id answers "which of their addresses was this?" and
   * keeps working while the row exists; the snapshot is what the parcel was
   * actually addressed to. A buyer editing or deleting a saved address must not
   * rewrite where a past order went, so the id is nullable with ON DELETE SET
   * NULL and the snapshot is the record of truth for fulfilment.
   *
   * Nullable overall because payments made before saved addresses existed have
   * neither, and because `deliveryZone` — not this — is what determines the fee
   * (see InitiatePaymentDto, Rule 14).
   */
  @Column({ type: 'uuid', nullable: true })
  shippingAddressId: string | null;

  @ManyToOne(() => ShippingAddress, {
    onDelete: 'SET NULL',
    nullable: true,
    eager: false,
  })
  @JoinColumn({ name: 'shippingAddressId' })
  shippingAddress: ShippingAddress | null;

  @Column({ type: 'jsonb', nullable: true })
  shippingAddressSnapshot: ShippingAddressSnapshot | null;

  // ─── Fonepay identifiers ──────────────────────────────────────────────────

  // Correlation key across the entire Fonepay flow; also used as Fonepay's `prn`.
  // Alphanumeric only, ≤30 chars. Globally unique — enforced by DB constraint.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  referenceLabel: string;

  @Column({ type: 'varchar', length: 16 })
  terminalId: string;

  // ─── QR payloads (populated after generate-intent-qr) ────────────────────

  // Full QR payload — used to render the scannable image on desktop.
  @Column({ type: 'text', nullable: true })
  qrString: string | null;

  // Short payload — combined with the bank's intentScheme on the frontend for the
  // mobile deep link: `${intentScheme}/?qrPayload=${encodeURIComponent(qrMessage)}`.
  @Column({ type: 'text', nullable: true })
  qrMessage: string | null;

  // `thirdpartyQRWebSocketUrl` from the Fonepay response (field may appear as
  // `websocketId` in some response variants). Backend holds this socket connection
  // and relays verified results to the frontend over SSE.
  @Column({ type: 'text', nullable: true })
  websocketUrl: string | null;

  // ─── Status ───────────────────────────────────────────────────────────────

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  // ─── Fonepay outcome (populated after status verification) ────────────────

  @Column({ type: 'varchar', nullable: true })
  fonepayTraceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  paymentMessage: string | null;

  // ─── Deadline ─────────────────────────────────────────────────────────────

  // Copied from Bid.paymentDeadline at initiation time so this row's deadline
  // is immutable even if PAYMENT_WINDOW_HOURS changes between config reloads.
  @Column({ type: 'timestamptz' })
  paymentDeadline: Date;

  // ─── Delivery (buyer-selected zone, cash on delivery — never through the
  // gateway, never counted toward points) ────────────────────────────────────

  @Column({ type: 'enum', enum: DeliveryZone })
  deliveryZone: DeliveryZone;

  // Snapshotted from DELIVERY_CHARGE_INSIDE_VALLEY / DELIVERY_CHARGE_OUTSIDE_VALLEY
  // at initiation time — immune to later env changes, same reasoning as paymentDeadline.
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  deliveryCharge: number;

  // ─── Seller settlement (admin-driven, separate from buyer payment above) ──
  // Populated only by RewardsService.markSellerPaid — the sole points/commission
  // trigger. Distinct from `status`/paymentConfirmed*, which track the BUYER's
  // gateway payment landing, not whether the SELLER has since been paid out.

  @Column({ type: 'timestamptz', nullable: true })
  sellerPaidAt: Date | null;

  // UUID FK → users (the admin who flagged the settlement). No explicit relation needed.
  @Column({ type: 'uuid', nullable: true })
  sellerPaidById: string | null;

  // basePrice + (commission% × profit) — the reference amount the admin pays
  // the seller offline before flagging this settlement.
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  sellerPayoutAmount: number | null;

  // The seller's tier/band commission %, snapshotted at settlement time.
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  sellerCommissionPercent: number | null;
}
