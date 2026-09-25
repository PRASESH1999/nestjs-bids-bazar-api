import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';
import { ProductSettlement } from '@modules/bidding/entities/product-settlement.entity';
import { ShippingAddress } from '@modules/shipping/entities/shipping-address.entity';

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

  // Item price only — never the delivery charge. RewardsService reads this
  // column directly for commission/points math (Rule 14: delivery never
  // counts toward points), so its meaning must never change.
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  /*
   * Snapshotted from DELIVERY_CHARGE_FLAT at initiation time — immune to a
   * later config change, same reasoning as paymentDeadline below. This is
   * NOT delivery/fulfilment data (that lives on ProductDelivery); it's a
   * record of what the Fonepay QR was actually generated for
   * (itemAmount + deliveryCharge). Without it, a payment confirmed hours
   * after initiation (Fonepay QRs stay valid for the whole payment window)
   * could snapshot a *different* current config value onto ProductDelivery
   * than what was truly charged.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  deliveryCharge: number;

  /*
   * Which saved address this attempt was for — just the id, not a snapshot
   * (the frozen recipient/address detail lives on ProductDelivery, created
   * only for the attempt that actually succeeds). Needed here because
   * `confirmSuccess`/`confirmPaymentManual` run later — sometimes much later,
   * in a separate request — and have to know which address to hand to
   * ProductDeliveriesService without re-deriving it. Nullable + SET NULL:
   * a buyer deleting the address afterward must not block confirming a
   * payment that already happened.
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
