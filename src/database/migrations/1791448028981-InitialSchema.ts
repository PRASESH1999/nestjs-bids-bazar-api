import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The whole schema, from scratch.
 *
 * Replaces the 23 incremental migrations (InitSchema1786643208117 …
 * AddDeliveryCancellation1790949137359), squashed when every database — dev,
 * test and live — was wiped. It only ever runs against an empty database;
 * the old files are in git history if they are ever needed.
 *
 * Generated from the entities, plus the two things generation cannot see:
 *  - the `uuid-ossp` extension, which every `uuid_generate_v4()` default needs.
 *    TypeORM installs it on connect, but the migration should not depend on it.
 *  - `username_seq`, which UsersRepository.nextUsernameSequenceValue draws from.
 */
export class InitialSchema1791448028981 implements MigrationInterface {
  name = 'InitialSchema1791448028981';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE SEQUENCE "username_seq" START WITH 1 INCREMENT BY 1`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('SUPERADMIN', 'ADMIN', 'USER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "username" character varying(30) NOT NULL, "email" character varying(255) NOT NULL, "fullName" character varying(150), "password" character varying(255), "googleId" character varying, "facebookId" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER', "isActive" boolean NOT NULL DEFAULT true, "isEmailVerified" boolean NOT NULL DEFAULT false, "hashedRefreshToken" character varying, "phone" character varying(20), "phoneVerifiedAt" TIMESTAMP WITH TIME ZONE, "phoneOtpHash" character varying, "phoneOtpExpiresAt" TIMESTAMP WITH TIME ZONE, "phoneOtpAttempts" integer NOT NULL DEFAULT '0', "pendingPhone" character varying(20), "averageRating" numeric(3,2) NOT NULL DEFAULT '0', "ratingCount" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_f382af58ab36057334fb262efd5" UNIQUE ("googleId"), CONSTRAINT "UQ_f9740e1e654a5daddb82c60bd75" UNIQUE ("facebookId"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_875541f7dbe1b8565414f9f80b" ON "users" ("phone") WHERE "phone" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "subcategories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "categoryId" uuid NOT NULL, "name" character varying(100) NOT NULL, "iconPath" character varying, "displayOrder" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_793ef34ad0a3f86f09d4837007c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d1fe096726c3c5b8a500950e44" ON "subcategories" ("categoryId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_45aa12007713728e241d091775" ON "subcategories" ("categoryId", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "name" character varying(100) NOT NULL, "iconPath" character varying, "displayOrder" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE ("name"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."kyc_verifications_documenttype_enum" AS ENUM('CITIZENSHIP', 'PASSPORT', 'NID_CARD')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."kyc_verifications_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "kyc_verifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userId" uuid NOT NULL, "fullName" character varying(150) NOT NULL, "documentType" "public"."kyc_verifications_documenttype_enum" NOT NULL, "documentId" character varying(50) NOT NULL, "citizenshipFrontPath" character varying, "citizenshipBackPath" character varying, "passportPath" character varying, "nidFrontPath" character varying, "emergencyContactPhone" character varying(20), "permanentAddress" jsonb NOT NULL, "temporaryAddress" jsonb, "remarks" character varying(1000), "status" "public"."kyc_verifications_status_enum" NOT NULL DEFAULT 'PENDING', "rejectionReason" text, "rejectedFields" jsonb, "reviewedBy" uuid, "reviewedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_f71e34495dae27087b5773b35b4" UNIQUE ("userId"), CONSTRAINT "PK_57b7c6b141dd225ce5dc95d7fb0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f71e34495dae27087b5773b35b" ON "kyc_verifications" ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_680274c8dbbf8c09808495ca15" ON "kyc_verifications" ("documentType", "documentId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "bank_details" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userId" uuid NOT NULL, "bankName" character varying(255) NOT NULL, "accountHolderName" character varying(255) NOT NULL, "accountNumber" text NOT NULL, "branch" text NOT NULL, "swiftCode" text, CONSTRAINT "UQ_d566e3c5f9b1b1c497d709c1fcc" UNIQUE ("userId"), CONSTRAINT "PK_ddbbcb9586b7f4d6124fe58f257" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productId" uuid NOT NULL, "filePath" character varying NOT NULL, "originalFilename" character varying NOT NULL, "mimeType" character varying NOT NULL, "sizeBytes" integer NOT NULL, "displayOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_20bf02e97d9e2fb1704f04b4513" UNIQUE ("productId", "displayOrder"), CONSTRAINT "PK_1974264ea7265989af8392f63a1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b367708bf720c8dd62fc683316" ON "product_images" ("productId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."products_condition_enum" AS ENUM('NEW', 'LIKE_NEW', 'USED_GOOD', 'USED_FAIR', 'FOR_PARTS')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."products_status_enum" AS ENUM('DRAFT', 'AWAITING_APPROVAL', 'REJECTED', 'AWAITING_FIRST_BID', 'ACTIVE', 'AWAITING_INSTANT_BUY', 'AWAITING_PAYMENT', 'SETTLED', 'ABANDONED', 'WITHDRAWN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "ownerId" uuid NOT NULL, "title" character varying(150), "description" text, "specifications" text, "categoryId" uuid, "subcategoryId" uuid, "condition" "public"."products_condition_enum", "status" "public"."products_status_enum" NOT NULL DEFAULT 'DRAFT', "basePrice" numeric(12,2), "biddingStartPrice" numeric(12,2), "instantBuyPrice" numeric(12,2), "biddingEndPrice" numeric(12,2), "currency" character varying(10) NOT NULL DEFAULT 'NPR', "biddingDurationHours" integer NOT NULL DEFAULT '72', "currentHighestBid" numeric(12,2), "currentHighestBidderId" uuid, "biddingStartedAt" TIMESTAMP WITH TIME ZONE, "biddingEndsAt" TIMESTAMP WITH TIME ZONE, "viewCount" integer NOT NULL DEFAULT '0', "isRare" boolean NOT NULL DEFAULT false, "submittedAt" TIMESTAMP WITH TIME ZONE, "reviewedById" uuid, "reviewedAt" TIMESTAMP WITH TIME ZONE, "rejectionReason" character varying, "province" character varying, "district" character varying, "city" character varying, "street" character varying, "wardNumber" integer, "winningBidId" uuid, "closedAt" TIMESTAMP WITH TIME ZONE, "settledAt" TIMESTAMP WITH TIME ZONE, "settledAmount" numeric(12,2), "abandonedAt" TIMESTAMP WITH TIME ZONE, "withdrawnAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_663aa9983fd61dfc310d407d4d" ON "products" ("ownerId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ff56834e735fa78a15d0cf2192" ON "products" ("categoryId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7527f75cb36bea4b7f2b86f7d1" ON "products" ("subcategoryId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1846199852a695713b1f8f5e9a" ON "products" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3bc014be6177ded36911df7db5" ON "products" ("categoryId", "subcategoryId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bca32e7e2b877bcaae255805c3" ON "products" ("ownerId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_58075ba759b7738eb2eac5a9af" ON "products" ("status", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bids_paymentstatus_enum" AS ENUM('NOT_RESPONSIBLE', 'PENDING', 'CONFIRMED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bids_paymentconfirmationmethod_enum" AS ENUM('ADMIN_MANUAL', 'BANK_API')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bids" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "productId" uuid NOT NULL, "bidderId" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "placedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "previousHighestAmount" numeric(12,2), "wasFirstBid" boolean NOT NULL DEFAULT false, "isOriginalWinner" boolean NOT NULL DEFAULT false, "fallbackRank" integer NOT NULL DEFAULT '0', "isCurrentlyPaymentResponsible" boolean NOT NULL DEFAULT false, "isInstantBuy" boolean NOT NULL DEFAULT false, "paymentStatus" "public"."bids_paymentstatus_enum" NOT NULL DEFAULT 'NOT_RESPONSIBLE', "paymentDeadline" TIMESTAMP WITH TIME ZONE, "paymentConfirmedAt" TIMESTAMP WITH TIME ZONE, "paymentConfirmedById" uuid, "paymentConfirmationMethod" "public"."bids_paymentconfirmationmethod_enum", "paymentWarningSentAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_7950d066d322aab3a488ac39fe5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ed46f16a2ffae8257bf8524956" ON "bids" ("productId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fe34abd3aeb153efaea7a03c67" ON "bids" ("bidderId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b4e27104205a2f5aa6a71746dc" ON "bids" ("productId") WHERE "isCurrentlyPaymentResponsible" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8b351ea3618d54fd447818fb90" ON "bids" ("productId", "fallbackRank") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cd25f308f3161e81b7ce022662" ON "bids" ("paymentStatus", "paymentDeadline") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f76ca8600d0dd4774ac6fb3676" ON "bids" ("bidderId", "placedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2616414c161d4309eb48abc015" ON "bids" ("productId", "amount") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_settlements_status_enum" AS ENUM('PENDING_PAYMENT', 'SETTLED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_settlements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "productId" uuid NOT NULL, "sellerId" uuid NOT NULL, "bidId" uuid NOT NULL, "bidWinnerId" uuid NOT NULL, "fallbackRank" integer NOT NULL, "amount" numeric(12,2) NOT NULL, "status" "public"."product_settlements_status_enum" NOT NULL DEFAULT 'PENDING_PAYMENT', "paymentDeadline" TIMESTAMP WITH TIME ZONE NOT NULL, "resolvedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_32f94edcf989317ef8f6a408ac4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f28509c6f4572e9e3e2b25e3b1" ON "product_settlements" ("productId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e75a511dec4f30d4479b934b9f" ON "product_settlements" ("bidId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_44f38944fa0c33180393d266bc" ON "product_settlements" ("productId") WHERE "status" = 'PENDING_PAYMENT'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_60b15b3353a02724d1d76fbec1" ON "product_settlements" ("productId", "fallbackRank") `,
    );
    await queryRunner.query(
      `CREATE TABLE "shipping_addresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userId" uuid NOT NULL, "label" character varying(50) NOT NULL, "recipientName" character varying(150) NOT NULL, "recipientPhone" character varying(20) NOT NULL, "province" character varying(100) NOT NULL, "district" character varying(100) NOT NULL, "city" character varying(100) NOT NULL, "street" character varying(255) NOT NULL, "wardNumber" character varying(20), "landmark" character varying(500), "pathaoCityId" integer, "pathaoCityName" character varying, "pathaoZoneId" integer, "pathaoZoneName" character varying, "pathaoAreaId" integer, "pathaoAreaName" character varying, "isDefault" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_cced78984eddbbe24470f226692" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6f522735551c716dc489635b5b" ON "shipping_addresses" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ba545447fbdc039932d716bbab" ON "shipping_addresses" ("userId", "isDefault") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_payments_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "productId" uuid NOT NULL, "productSettlementId" uuid NOT NULL, "sellerId" uuid NOT NULL, "winnerUserId" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "deliveryCharge" numeric(10,2) NOT NULL, "shippingAddressId" uuid, "referenceLabel" character varying(30) NOT NULL, "terminalId" character varying(16) NOT NULL, "qrString" text, "qrMessage" text, "websocketUrl" text, "status" "public"."product_payments_status_enum" NOT NULL DEFAULT 'PENDING', "fonepayTraceId" character varying, "paymentMessage" character varying, "paymentDeadline" TIMESTAMP WITH TIME ZONE NOT NULL, "sellerPaidAt" TIMESTAMP WITH TIME ZONE, "sellerPaidById" uuid, "sellerPayoutAmount" numeric(12,2), "sellerCommissionPercent" numeric(5,2), CONSTRAINT "PK_acbbf7050eef624e7e81bb65c51" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bf1f077cf16bfc3bb28304cfab" ON "product_payments" ("productId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fd41af63c08957822228a39a32" ON "product_payments" ("productSettlementId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_91d660c047775f3a9ad6902f73" ON "product_payments" ("winnerUserId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9b87494b9959394a32cc704b19" ON "product_payments" ("referenceLabel") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_d9dc1920b5fc46b8e5f7209f52" ON "product_payments" ("productSettlementId") WHERE "status" = 'PENDING'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e716286026f74a8bfe05b4502e" ON "product_payments" ("winnerUserId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9198b3dbab691f73c3c95c81bf" ON "product_payments" ("productId", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "email_verification_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_417a095bbed21c2369a6a01ab9a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_email_verification_tokens_user_id" ON "email_verification_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_email_verification_tokens_token_hash" ON "email_verification_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_user_id" ON "password_reset_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_token_hash" ON "password_reset_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_expires_at" ON "password_reset_tokens" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "pending_email_changes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "new_email" character varying(255) NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_2257e65ef4e5517f7eb450f6bf4" UNIQUE ("user_id"), CONSTRAINT "PK_974a0acecd615af6eb2db57e170" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_pending_email_changes_user_id" ON "pending_email_changes" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pending_email_changes_token_hash" ON "pending_email_changes" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_rewards_sellertier_enum" AS ENUM('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_rewards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userId" uuid NOT NULL, "buyerPoints" integer NOT NULL DEFAULT '0', "sellerPoints" integer NOT NULL DEFAULT '0', "sellerTier" "public"."user_rewards_sellertier_enum" NOT NULL DEFAULT 'BRONZE', CONSTRAINT "UQ_d538de4678c82491e5a8a8a5834" UNIQUE ("userId"), CONSTRAINT "PK_86078010f64a891601beef7c54f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d538de4678c82491e5a8a8a583" ON "user_rewards" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."points_transactions_type_enum" AS ENUM('BUYER', 'SELLER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "points_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userId" uuid NOT NULL, "type" "public"."points_transactions_type_enum" NOT NULL, "delta" integer NOT NULL, "reason" text NOT NULL, "referenceId" uuid, CONSTRAINT "PK_b368729603fe6bc50fdb6750b33" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ac28945bbf0761c3e6fe0c816b" ON "points_transactions" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5fa6b575b1f20bf2a46235ae22" ON "points_transactions" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "specifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "name" character varying(100) NOT NULL, "displayOrder" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_44e3bc32836e8579978ecc6c6cf" UNIQUE ("name"), CONSTRAINT "PK_621aabf71e640ab86f0e8b62a37" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('BID_PLACED_SELLER', 'OUTBID', 'AUCTION_WON', 'AUCTION_CLOSED_SELLER', 'PAYMENT_WINDOW_EXPIRING', 'PAYMENT_FAILED_FALLBACK', 'PAYMENT_FAILED_SELLER', 'AUCTION_ABANDONED', 'PAYMENT_CONFIRMED_SELLER', 'PAYMENT_CONFIRMED_BUYER', 'INSTANT_BUY_EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userId" uuid NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "relatedId" uuid NOT NULL, "title" character varying(255) NOT NULL, "message" text NOT NULL, "data" jsonb, "isRead" boolean NOT NULL DEFAULT false, "readAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_94f15ddcb2549b7afac0e55ffb" ON "notifications" ("userId", "type", "relatedId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_adb71380622f8eb91ce89d5ecc" ON "notifications" ("userId", "isRead", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "favorites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userId" uuid NOT NULL, "productId" uuid NOT NULL, CONSTRAINT "PK_890818d27523748dd36a4d1bdc8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0108a9b4ed312b4d34dc0c43e1" ON "favorites" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_783e5111df14529ff6124351b1" ON "favorites" ("userId", "productId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_reports_status_enum" AS ENUM('PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "reporterId" uuid NOT NULL, "productId" uuid NOT NULL, "reportedUserId" uuid NOT NULL, "remarks" text NOT NULL, "status" "public"."product_reports_status_enum" NOT NULL DEFAULT 'PENDING', "adminNote" text, CONSTRAINT "PK_57b3bd50de73401641fd93a2fcf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1c1004896d463a9d26b2fea56c" ON "product_reports" ("reportedUserId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e18f805b13b851ae5fbf326399" ON "product_reports" ("status", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_77cb24169f3eb8fbe19b5c8b2f" ON "product_reports" ("reporterId", "productId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "seller_ratings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "buyerId" uuid NOT NULL, "sellerId" uuid NOT NULL, "paymentId" uuid NOT NULL, "rating" integer NOT NULL, "remarks" text, CONSTRAINT "PK_f698f873830975c1fee3ba68d3e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7f0fb66e4ea20df651a1fa000c" ON "seller_ratings" ("sellerId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_6f42babf8a7351f3cb827ade2e" ON "seller_ratings" ("paymentId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."boost_items_scheme_enum" AS ENUM('PER_DAY', 'THREE_DAYS', 'SEVEN_DAYS', 'FIFTEEN_DAYS', 'THIRTY_DAYS')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."boost_items_status_enum" AS ENUM('PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "boost_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "productId" uuid NOT NULL, "sellerId" uuid NOT NULL, "scheme" "public"."boost_items_scheme_enum" NOT NULL, "amount" numeric(10,2) NOT NULL, "status" "public"."boost_items_status_enum" NOT NULL DEFAULT 'PENDING_PAYMENT', "startDateTime" TIMESTAMP WITH TIME ZONE, "endDateTime" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d96276db71ee5c90de478360316" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ef29c6863d56d3a9c9d721228" ON "boost_items" ("productId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a71a576d0e6e6b208309500171" ON "boost_items" ("productId") WHERE "status" IN ('PENDING_PAYMENT', 'ACTIVE')`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6a860378323fe760b069798b88" ON "boost_items" ("productId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cf4418010e27d99deb50d0304a" ON "boost_items" ("status", "startDateTime") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."boost_payments_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "boost_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "boostItemId" uuid NOT NULL, "productId" uuid NOT NULL, "sellerId" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "referenceLabel" character varying(30) NOT NULL, "terminalId" character varying(16) NOT NULL, "qrString" text, "qrMessage" text, "status" "public"."boost_payments_status_enum" NOT NULL DEFAULT 'PENDING', "fonepayTraceId" character varying, "paymentMessage" character varying, "paymentDeadline" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_4d3c4c36bc423bb28b3f4e0bf3c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_00bd60dcedbe7af797fb6c7e76" ON "boost_payments" ("boostItemId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a152f42d9addfd41f07fa8361" ON "boost_payments" ("productId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_50c808d5cf1f8227904f72696a" ON "boost_payments" ("referenceLabel") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_18696fcb6865e8e91bfad3d181" ON "boost_payments" ("boostItemId") WHERE "status" = 'PENDING'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5efaf345d79005418798677634" ON "boost_payments" ("sellerId", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40ad739f3e334da05b3549b1bd" ON "boost_payments" ("productId", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "product_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "productPaymentId" uuid NOT NULL, "recipientName" character varying(150) NOT NULL, "recipientPhone" character varying(20) NOT NULL, "province" character varying(100) NOT NULL, "district" character varying(100) NOT NULL, "city" character varying(100) NOT NULL, "street" character varying(255) NOT NULL, "wardNumber" character varying(20), "landmark" character varying(500), "pathaoCityId" integer NOT NULL, "pathaoCityName" character varying, "pathaoZoneId" integer NOT NULL, "pathaoZoneName" character varying, "pathaoAreaId" integer, "pathaoAreaName" character varying, "deliveryCharge" numeric(10,2) NOT NULL, "receivedAtWarehouseAt" TIMESTAMP WITH TIME ZONE, "receivedAtWarehouseById" uuid, "storeId" integer, "consignmentId" character varying, "itemWeightKg" numeric(5,2), "itemDescription" character varying, "amountToCollect" numeric(10,2) NOT NULL DEFAULT '0', "pathaoDeliveryFee" numeric(10,2), "dispatchedById" uuid, "dispatchedAt" TIMESTAMP WITH TIME ZONE, "orderStatus" character varying, "lastStatusCheckAt" TIMESTAMP WITH TIME ZONE, "deliveredAt" TIMESTAMP WITH TIME ZONE, "cancelledAt" TIMESTAMP WITH TIME ZONE, "previousConsignmentIds" text array NOT NULL DEFAULT '{}', CONSTRAINT "PK_4ee290e6efbebbb6fb6a9e808fa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_124f23fdbc51c8964fd434bfc8" ON "product_deliveries" ("productPaymentId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9623ad7b04e95c837117b3d9bd" ON "product_deliveries" ("consignmentId") WHERE "consignmentId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "subcategories" ADD CONSTRAINT "FK_d1fe096726c3c5b8a500950e448" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_images" ADD CONSTRAINT "FK_b367708bf720c8dd62fc6833161" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bids" ADD CONSTRAINT "FK_ed46f16a2ffae8257bf85249562" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bids" ADD CONSTRAINT "FK_fe34abd3aeb153efaea7a03c676" FOREIGN KEY ("bidderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_settlements" ADD CONSTRAINT "FK_f28509c6f4572e9e3e2b25e3b10" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_settlements" ADD CONSTRAINT "FK_44b3b4119737bafd73d85823a19" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_settlements" ADD CONSTRAINT "FK_e75a511dec4f30d4479b934b9f8" FOREIGN KEY ("bidId") REFERENCES "bids"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_settlements" ADD CONSTRAINT "FK_9ec8327c229623351833d9ded76" FOREIGN KEY ("bidWinnerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" ADD CONSTRAINT "FK_6f522735551c716dc489635b5b7" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" ADD CONSTRAINT "FK_bf1f077cf16bfc3bb28304cfab5" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" ADD CONSTRAINT "FK_fd41af63c08957822228a39a326" FOREIGN KEY ("productSettlementId") REFERENCES "product_settlements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" ADD CONSTRAINT "FK_dce4aca974ab21b2c63c6cac5fb" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" ADD CONSTRAINT "FK_91d660c047775f3a9ad6902f739" FOREIGN KEY ("winnerUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" ADD CONSTRAINT "FK_47e86f470a39dcd3204b073c91c" FOREIGN KEY ("shippingAddressId") REFERENCES "shipping_addresses"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" ADD CONSTRAINT "FK_e747534006c6e3c2f09939da60f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" ADD CONSTRAINT "FK_0c7bba48aac77ad13092685ba5b" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_reports" ADD CONSTRAINT "FK_8df8a3db47ccb2bad377c852305" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_reports" ADD CONSTRAINT "FK_5f76f68e7b084bbcd31f36df78b" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_reports" ADD CONSTRAINT "FK_1c1004896d463a9d26b2fea56c1" FOREIGN KEY ("reportedUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_ratings" ADD CONSTRAINT "FK_1606624daf84ff30e039cdaabf7" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_ratings" ADD CONSTRAINT "FK_95db746b058b5275d492683306e" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_ratings" ADD CONSTRAINT "FK_6f42babf8a7351f3cb827ade2ec" FOREIGN KEY ("paymentId") REFERENCES "product_payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_items" ADD CONSTRAINT "FK_3ef29c6863d56d3a9c9d721228e" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_items" ADD CONSTRAINT "FK_c5ef00d5396223dbde36b52f83f" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_payments" ADD CONSTRAINT "FK_00bd60dcedbe7af797fb6c7e76c" FOREIGN KEY ("boostItemId") REFERENCES "boost_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_payments" ADD CONSTRAINT "FK_9a152f42d9addfd41f07fa8361d" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_payments" ADD CONSTRAINT "FK_11b839803f6d3b4cbba033993e1" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_deliveries" ADD CONSTRAINT "FK_124f23fdbc51c8964fd434bfc84" FOREIGN KEY ("productPaymentId") REFERENCES "product_payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_deliveries" DROP CONSTRAINT "FK_124f23fdbc51c8964fd434bfc84"`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_payments" DROP CONSTRAINT "FK_11b839803f6d3b4cbba033993e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_payments" DROP CONSTRAINT "FK_9a152f42d9addfd41f07fa8361d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_payments" DROP CONSTRAINT "FK_00bd60dcedbe7af797fb6c7e76c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_items" DROP CONSTRAINT "FK_c5ef00d5396223dbde36b52f83f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "boost_items" DROP CONSTRAINT "FK_3ef29c6863d56d3a9c9d721228e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_ratings" DROP CONSTRAINT "FK_6f42babf8a7351f3cb827ade2ec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_ratings" DROP CONSTRAINT "FK_95db746b058b5275d492683306e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_ratings" DROP CONSTRAINT "FK_1606624daf84ff30e039cdaabf7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_reports" DROP CONSTRAINT "FK_1c1004896d463a9d26b2fea56c1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_reports" DROP CONSTRAINT "FK_5f76f68e7b084bbcd31f36df78b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_reports" DROP CONSTRAINT "FK_8df8a3db47ccb2bad377c852305"`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" DROP CONSTRAINT "FK_0c7bba48aac77ad13092685ba5b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" DROP CONSTRAINT "FK_e747534006c6e3c2f09939da60f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" DROP CONSTRAINT "FK_47e86f470a39dcd3204b073c91c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" DROP CONSTRAINT "FK_91d660c047775f3a9ad6902f739"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" DROP CONSTRAINT "FK_dce4aca974ab21b2c63c6cac5fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" DROP CONSTRAINT "FK_fd41af63c08957822228a39a326"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_payments" DROP CONSTRAINT "FK_bf1f077cf16bfc3bb28304cfab5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipping_addresses" DROP CONSTRAINT "FK_6f522735551c716dc489635b5b7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_settlements" DROP CONSTRAINT "FK_9ec8327c229623351833d9ded76"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_settlements" DROP CONSTRAINT "FK_e75a511dec4f30d4479b934b9f8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_settlements" DROP CONSTRAINT "FK_44b3b4119737bafd73d85823a19"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_settlements" DROP CONSTRAINT "FK_f28509c6f4572e9e3e2b25e3b10"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bids" DROP CONSTRAINT "FK_fe34abd3aeb153efaea7a03c676"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bids" DROP CONSTRAINT "FK_ed46f16a2ffae8257bf85249562"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_images" DROP CONSTRAINT "FK_b367708bf720c8dd62fc6833161"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subcategories" DROP CONSTRAINT "FK_d1fe096726c3c5b8a500950e448"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9623ad7b04e95c837117b3d9bd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_124f23fdbc51c8964fd434bfc8"`,
    );
    await queryRunner.query(`DROP TABLE "product_deliveries"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_40ad739f3e334da05b3549b1bd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5efaf345d79005418798677634"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_18696fcb6865e8e91bfad3d181"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_50c808d5cf1f8227904f72696a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a152f42d9addfd41f07fa8361"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_00bd60dcedbe7af797fb6c7e76"`,
    );
    await queryRunner.query(`DROP TABLE "boost_payments"`);
    await queryRunner.query(`DROP TYPE "public"."boost_payments_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cf4418010e27d99deb50d0304a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6a860378323fe760b069798b88"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a71a576d0e6e6b208309500171"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3ef29c6863d56d3a9c9d721228"`,
    );
    await queryRunner.query(`DROP TABLE "boost_items"`);
    await queryRunner.query(`DROP TYPE "public"."boost_items_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."boost_items_scheme_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6f42babf8a7351f3cb827ade2e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7f0fb66e4ea20df651a1fa000c"`,
    );
    await queryRunner.query(`DROP TABLE "seller_ratings"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_77cb24169f3eb8fbe19b5c8b2f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e18f805b13b851ae5fbf326399"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1c1004896d463a9d26b2fea56c"`,
    );
    await queryRunner.query(`DROP TABLE "product_reports"`);
    await queryRunner.query(`DROP TYPE "public"."product_reports_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_783e5111df14529ff6124351b1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0108a9b4ed312b4d34dc0c43e1"`,
    );
    await queryRunner.query(`DROP TABLE "favorites"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_adb71380622f8eb91ce89d5ecc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_94f15ddcb2549b7afac0e55ffb"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(`DROP TABLE "specifications"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5fa6b575b1f20bf2a46235ae22"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ac28945bbf0761c3e6fe0c816b"`,
    );
    await queryRunner.query(`DROP TABLE "points_transactions"`);
    await queryRunner.query(
      `DROP TYPE "public"."points_transactions_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d538de4678c82491e5a8a8a583"`,
    );
    await queryRunner.query(`DROP TABLE "user_rewards"`);
    await queryRunner.query(
      `DROP TYPE "public"."user_rewards_sellertier_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_pending_email_changes_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_pending_email_changes_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "pending_email_changes"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_email_verification_tokens_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_email_verification_tokens_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "email_verification_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9198b3dbab691f73c3c95c81bf"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e716286026f74a8bfe05b4502e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d9dc1920b5fc46b8e5f7209f52"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9b87494b9959394a32cc704b19"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_91d660c047775f3a9ad6902f73"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fd41af63c08957822228a39a32"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bf1f077cf16bfc3bb28304cfab"`,
    );
    await queryRunner.query(`DROP TABLE "product_payments"`);
    await queryRunner.query(
      `DROP TYPE "public"."product_payments_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ba545447fbdc039932d716bbab"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6f522735551c716dc489635b5b"`,
    );
    await queryRunner.query(`DROP TABLE "shipping_addresses"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_60b15b3353a02724d1d76fbec1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_44f38944fa0c33180393d266bc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e75a511dec4f30d4479b934b9f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f28509c6f4572e9e3e2b25e3b1"`,
    );
    await queryRunner.query(`DROP TABLE "product_settlements"`);
    await queryRunner.query(
      `DROP TYPE "public"."product_settlements_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2616414c161d4309eb48abc015"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f76ca8600d0dd4774ac6fb3676"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cd25f308f3161e81b7ce022662"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8b351ea3618d54fd447818fb90"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b4e27104205a2f5aa6a71746dc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fe34abd3aeb153efaea7a03c67"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ed46f16a2ffae8257bf8524956"`,
    );
    await queryRunner.query(`DROP TABLE "bids"`);
    await queryRunner.query(
      `DROP TYPE "public"."bids_paymentconfirmationmethod_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."bids_paymentstatus_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_58075ba759b7738eb2eac5a9af"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bca32e7e2b877bcaae255805c3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3bc014be6177ded36911df7db5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1846199852a695713b1f8f5e9a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7527f75cb36bea4b7f2b86f7d1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ff56834e735fa78a15d0cf2192"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_663aa9983fd61dfc310d407d4d"`,
    );
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TYPE "public"."products_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."products_condition_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b367708bf720c8dd62fc683316"`,
    );
    await queryRunner.query(`DROP TABLE "product_images"`);
    await queryRunner.query(`DROP TABLE "bank_details"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_680274c8dbbf8c09808495ca15"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f71e34495dae27087b5773b35b"`,
    );
    await queryRunner.query(`DROP TABLE "kyc_verifications"`);
    await queryRunner.query(
      `DROP TYPE "public"."kyc_verifications_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."kyc_verifications_documenttype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_45aa12007713728e241d091775"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d1fe096726c3c5b8a500950e44"`,
    );
    await queryRunner.query(`DROP TABLE "subcategories"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_875541f7dbe1b8565414f9f80b"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP SEQUENCE "username_seq"`);
    // `uuid-ossp` is left installed: extensions are database-wide and may
    // be relied on by something other than this schema.
  }
}
