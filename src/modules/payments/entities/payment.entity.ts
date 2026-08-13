import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { DeliveryZone } from '@common/enums/delivery-zone.enum';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';

@Entity('payments')
@Index(['productId', 'status'])
@Index(['winnerUserId', 'status'])
// Partial unique index: at most one PENDING (in-flight QR attempt) per product at a time.
// SUCCESS payments are guarded at the service layer — initiatePayment must reject if a
// SUCCESS row already exists for this product, regardless of winner.
@Index(['productId'], {
  where: `"status" = 'PENDING'`,
  unique: true,
})
export class Payment extends BaseEntity {
  // ─── Product & winner ─────────────────────────────────────────────────────

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
