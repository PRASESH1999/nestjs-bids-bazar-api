import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Response as NestResponse,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { existsSync, createReadStream } from 'fs';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { KycStatus } from '@common/enums/kyc-status.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import { PaginationDto } from '@common/dto/pagination.dto';
import { KycService } from './kyc.service';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';

@ApiTags('kyc')
@ApiBearerAuth()
@Controller('kyc')
@UseGuards(PermissionsGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('submit')
  @ApiOperation({
    summary: 'Submit KYC documents and details for verification',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: SubmitKycDto })
  @RequirePermissions(Permission.KYC_SUBMIT)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'citizenshipFront', maxCount: 1 },
        { name: 'citizenshipBack', maxCount: 1 },
        { name: 'passport', maxCount: 1 },
      ],
      { storage: memoryStorage() },
    ),
  )
  async submitKyc(
    @Request() req: RequestWithUser,
    @Body() dto: SubmitKycDto,
    @UploadedFiles()
    files: {
      citizenshipFront?: Express.Multer.File[];
      citizenshipBack?: Express.Multer.File[];
      passport?: Express.Multer.File[];
    },
  ) {
    return this.kycService.submitKyc(req.user.sub, dto, files ?? {});
  }

  @Get('me')
  @ApiOperation({ summary: 'Get own KYC status and details' })
  @RequirePermissions(Permission.KYC_VIEW_OWN)
  async getMyKyc(@Request() req: RequestWithUser) {
    return this.kycService.getMyKyc(req.user.sub);
  }

  @Get()
  @ApiOperation({
    summary:
      'List all KYC submissions with optional status filter (Admin/SuperAdmin)',
  })
  @RequirePermissions(Permission.KYC_VIEW_ALL)
  async getAllKyc(
    @Query() pagination: PaginationDto,
    @Query('status') status?: KycStatus,
  ) {
    return this.kycService.getAllKyc(pagination, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full KYC record by ID (Admin/SuperAdmin)' })
  @RequirePermissions(Permission.KYC_VIEW_ALL)
  async getKycById(@Param('id') id: string) {
    return this.kycService.getKycById(id);
  }

  @Patch(':id/review')
  @ApiOperation({
    summary: 'Approve or reject a KYC submission (Admin/SuperAdmin)',
  })
  @RequirePermissions(Permission.KYC_REVIEW)
  async reviewKyc(
    @Param('id') id: string,
    @Body() dto: ReviewKycDto,
    @Request() req: RequestWithUser,
  ) {
    return this.kycService.reviewKyc(id, dto, req.user.sub);
  }

  @Get(':id/bank')
  @ApiOperation({
    summary: 'Get decrypted bank details for a KYC record (SuperAdmin only)',
  })
  @RequirePermissions(Permission.BANK_VIEW_DECRYPTED)
  async getDecryptedBankDetails(@Param('id') id: string) {
    return this.kycService.getDecryptedBankDetails(id);
  }

  @Get(':id/documents/:fileKey')
  @ApiOperation({
    summary: 'Stream a KYC document file (Admin/SuperAdmin only)',
  })
  @RequirePermissions(Permission.KYC_VIEW_ALL)
  async getDocument(
    @Param('id') id: string,
    @Param('fileKey') fileKey: string,
    @NestResponse({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { absolutePath, mimetype } = await this.kycService.getDocumentFile(
      id,
      fileKey,
    );

    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Document file not found on server');
    }

    res.set({
      'Content-Type': mimetype,
      'Content-Disposition': `inline; filename="${fileKey}"`,
    });

    return new StreamableFile(createReadStream(absolutePath));
  }
}
