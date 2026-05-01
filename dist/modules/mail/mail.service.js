"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer = __importStar(require("nodemailer"));
const kyc_approved_template_1 = require("./templates/kyc-approved.template");
const kyc_received_template_1 = require("./templates/kyc-received.template");
const kyc_rejected_template_1 = require("./templates/kyc-rejected.template");
const verify_email_template_1 = require("./templates/verify-email.template");
const product_submitted_template_1 = require("./templates/product-submitted.template");
const product_approved_template_1 = require("./templates/product-approved.template");
const product_rejected_template_1 = require("./templates/product-rejected.template");
let MailService = MailService_1 = class MailService {
    configService;
    logger = new common_1.Logger(MailService_1.name);
    transporter;
    constructor(configService) {
        this.configService = configService;
    }
    async onModuleInit() {
        this.transporter = nodemailer.createTransport({
            host: this.configService.getOrThrow('MAIL_HOST'),
            port: this.configService.getOrThrow('MAIL_PORT'),
            secure: this.configService.get('MAIL_SECURE') === 'true',
            auth: {
                user: this.configService.getOrThrow('MAIL_USER'),
                pass: this.configService.getOrThrow('MAIL_PASSWORD'),
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
        try {
            await this.transporter.verify();
            this.logger.log('SMTP Connection verified successfully');
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`SMTP Connection failed: ${message}`);
        }
    }
    async sendVerificationEmail(to, rawToken) {
        const frontendUrl = this.configService.getOrThrow('APP_FRONTEND_URL');
        const verificationUrl = `${frontendUrl}/auth/verify-email?token=${rawToken}`;
        const { subject, html } = (0, verify_email_template_1.verifyEmailTemplate)(verificationUrl);
        await this.send(to, subject, html);
        this.logger.log('Verification email dispatched', { to });
    }
    async sendKycReceived(to, name) {
        const { subject, html } = (0, kyc_received_template_1.kycReceivedTemplate)(name);
        await this.send(to, subject, html);
        this.logger.log('KYC received email dispatched', { to });
    }
    async sendKycApproved(to, name) {
        const frontendUrl = this.configService.getOrThrow('APP_FRONTEND_URL');
        const sellingUrl = `${frontendUrl}/sell`;
        const { subject, html } = (0, kyc_approved_template_1.kycApprovedTemplate)(name, sellingUrl);
        await this.send(to, subject, html);
        this.logger.log('KYC approved email dispatched', { to });
    }
    async sendKycRejected(to, name, reason) {
        const frontendUrl = this.configService.getOrThrow('APP_FRONTEND_URL');
        const resubmitUrl = `${frontendUrl}/kyc/submit`;
        const { subject, html } = (0, kyc_rejected_template_1.kycRejectedTemplate)(name, reason, resubmitUrl);
        await this.send(to, subject, html);
        this.logger.log('KYC rejected email dispatched', { to });
    }
    async sendProductSubmitted(to, name, productTitle) {
        const { subject, html } = (0, product_submitted_template_1.productSubmittedTemplate)(name, productTitle);
        await this.send(to, subject, html);
        this.logger.log('Product submitted email dispatched', { to });
    }
    async sendProductApproved(to, name, productTitle) {
        const frontendUrl = this.configService.getOrThrow('APP_FRONTEND_URL');
        const listingUrl = `${frontendUrl}/products`;
        const { subject, html } = (0, product_approved_template_1.productApprovedTemplate)(name, productTitle, listingUrl);
        await this.send(to, subject, html);
        this.logger.log('Product approved email dispatched', { to });
    }
    async sendProductRejected(to, name, productTitle, reason) {
        const frontendUrl = this.configService.getOrThrow('APP_FRONTEND_URL');
        const resubmitUrl = `${frontendUrl}/products/me`;
        const { subject, html } = (0, product_rejected_template_1.productRejectedTemplate)(name, productTitle, reason, resubmitUrl);
        await this.send(to, subject, html);
        this.logger.log('Product rejected email dispatched', { to });
    }
    async send(to, subject, html) {
        const from = this.configService.getOrThrow('MAIL_FROM');
        try {
            await this.transporter.sendMail({ from, to, subject, html });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Failed to send email', {
                to,
                subject,
                error: message,
            });
        }
    }
};
exports.MailService = MailService;
exports.MailService = MailService = MailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailService);
//# sourceMappingURL=mail.service.js.map