import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../modules/users/entities/user.entity';
import { Category } from '../modules/categories/entities/category.entity';
import { Subcategory } from '../modules/categories/entities/subcategory.entity';
import { KycVerification } from '../modules/kyc/entities/kyc-verification.entity';
import { BankDetail } from '../modules/kyc/entities/bank-detail.entity';
import { Product } from '../modules/products/entities/product.entity';
import { ProductImage } from '../modules/products/entities/product-image.entity';
import { Bid } from '../modules/bidding/entities/bid.entity';
import { Payment } from '../modules/payments/entities/payment.entity';
import { EmailVerificationToken } from '../modules/auth/entities/email-verification-token.entity';
import { PasswordResetToken } from '../modules/auth/entities/password-reset-token.entity';
import { PendingEmailChange } from '../modules/auth/entities/pending-email-change.entity';
import { UserRewards } from '../modules/rewards/entities/user-rewards.entity';
import { PointsTransaction } from '../modules/rewards/entities/points-transaction.entity';

config({ path: '.env.development' });

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true',
  entities: [
    User,
    Category,
    Subcategory,
    KycVerification,
    BankDetail,
    Product,
    ProductImage,
    Bid,
    Payment,
    EmailVerificationToken,
    PasswordResetToken,
    PendingEmailChange,
    UserRewards,
    PointsTransaction,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
