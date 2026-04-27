import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class MailService implements OnModuleInit {
    private readonly configService;
    private readonly logger;
    private transporter;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    sendVerificationEmail(to: string, rawToken: string): Promise<void>;
    sendKycReceived(to: string, name: string): Promise<void>;
    sendKycApproved(to: string, name: string): Promise<void>;
    sendKycRejected(to: string, name: string, reason: string): Promise<void>;
    private send;
}
