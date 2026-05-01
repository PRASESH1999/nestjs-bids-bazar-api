"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const fs_1 = require("fs");
const multer_1 = require("multer");
const require_permissions_decorator_1 = require("../../common/decorators/require-permissions.decorator");
const permission_enum_1 = require("../../common/enums/permission.enum");
const kyc_status_enum_1 = require("../../common/enums/kyc-status.enum");
const permissions_guard_1 = require("../../common/guards/permissions.guard");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
const kyc_service_1 = require("./kyc.service");
const review_kyc_dto_1 = require("./dto/review-kyc.dto");
const submit_kyc_dto_1 = require("./dto/submit-kyc.dto");
let KycController = class KycController {
    kycService;
    constructor(kycService) {
        this.kycService = kycService;
    }
    async submitKyc(req, dto, files) {
        return this.kycService.submitKyc(req.user.sub, dto, files ?? {});
    }
    async getMyKyc(req) {
        return this.kycService.getMyKyc(req.user.sub);
    }
    async getAllKyc(pagination, status) {
        return this.kycService.getAllKyc(pagination, status);
    }
    async getKycById(id) {
        return this.kycService.getKycById(id);
    }
    async reviewKyc(id, dto, req) {
        return this.kycService.reviewKyc(id, dto, req.user.sub);
    }
    async getDecryptedBankDetails(id) {
        return this.kycService.getDecryptedBankDetails(id);
    }
    async getDocument(id, fileKey, res) {
        const { absolutePath, mimetype } = await this.kycService.getDocumentFile(id, fileKey);
        if (!(0, fs_1.existsSync)(absolutePath)) {
            throw new common_1.NotFoundException('Document file not found on server');
        }
        res.set({
            'Content-Type': mimetype,
            'Content-Disposition': `inline; filename="${fileKey}"`,
        });
        return new common_1.StreamableFile((0, fs_1.createReadStream)(absolutePath));
    }
};
exports.KycController = KycController;
__decorate([
    (0, common_1.Post)('submit'),
    (0, swagger_1.ApiOperation)({
        summary: 'Submit KYC documents and details for verification',
    }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({ type: submit_kyc_dto_1.SubmitKycDto }),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.KYC_SUBMIT),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'citizenshipFront', maxCount: 1 },
        { name: 'citizenshipBack', maxCount: 1 },
        { name: 'passport', maxCount: 1 },
    ], { storage: (0, multer_1.memoryStorage)() })),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, submit_kyc_dto_1.SubmitKycDto, Object]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "submitKyc", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Get own KYC status and details' }),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.KYC_VIEW_OWN),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "getMyKyc", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'List all KYC submissions with optional status filter (Admin/SuperAdmin)',
    }),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.KYC_VIEW_ALL),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationDto, String]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "getAllKyc", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get full KYC record by ID (Admin/SuperAdmin)' }),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.KYC_VIEW_ALL),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "getKycById", null);
__decorate([
    (0, common_1.Patch)(':id/review'),
    (0, swagger_1.ApiOperation)({
        summary: 'Approve or reject a KYC submission (Admin/SuperAdmin)',
    }),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.KYC_REVIEW),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, review_kyc_dto_1.ReviewKycDto, Object]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "reviewKyc", null);
__decorate([
    (0, common_1.Get)(':id/bank'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get decrypted bank details for a KYC record (SuperAdmin only)',
    }),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.BANK_VIEW_DECRYPTED),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "getDecryptedBankDetails", null);
__decorate([
    (0, common_1.Get)(':id/documents/:fileKey'),
    (0, swagger_1.ApiOperation)({
        summary: 'Stream a KYC document file (Admin/SuperAdmin only)',
    }),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.KYC_VIEW_ALL),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('fileKey')),
    __param(2, (0, common_1.Response)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "getDocument", null);
exports.KycController = KycController = __decorate([
    (0, swagger_1.ApiTags)('kyc'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('kyc'),
    (0, common_1.UseGuards)(permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [kyc_service_1.KycService])
], KycController);
//# sourceMappingURL=kyc.controller.js.map