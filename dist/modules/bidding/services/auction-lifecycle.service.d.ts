import { ConfigService } from '@nestjs/config';
import { DataSource, QueryRunner } from 'typeorm';
import { Product } from "../../products/entities/product.entity";
import { MailService } from "../../mail/mail.service";
export declare class AuctionLifecycleService {
    private readonly dataSource;
    private readonly configService;
    private readonly mailService;
    private readonly logger;
    constructor(dataSource: DataSource, configService: ConfigService, mailService: MailService);
    closeIfExpired(productId: string, externalQueryRunner?: QueryRunner): Promise<void>;
    handlePaymentExpiry(productId: string, externalQueryRunner?: QueryRunner): Promise<void>;
    confirmPaymentManual(adminId: string, productId: string): Promise<Product>;
    closeAllExpiredAuctions(): Promise<{
        processed: number;
        errors: number;
    }>;
    expireAllOverduePaymentWindows(): Promise<{
        processed: number;
        errors: number;
    }>;
    sendPaymentWarnings(): Promise<{
        sent: number;
        errors: number;
    }>;
}
