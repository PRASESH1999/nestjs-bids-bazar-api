import * as crypto from 'crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentType } from '@common/enums/document-type.enum';
import { KycStatus } from '@common/enums/kyc-status.enum';
import { KycVerification } from './entities/kyc-verification.entity';
import { KycService } from './kyc.service';
import { ReviewAction } from './dto/review-kyc.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';

function buildKyc(overrides: Partial<KycVerification> = {}): KycVerification {
  return {
    id: 'kyc-1',
    userId: 'user-1',
    documentType: DocumentType.NID_CARD,
    citizenshipFrontPath: null,
    citizenshipBackPath: null,
    passportPath: null,
    nidFrontPath: '/nid-front.png',
    nidBackPath: '/nid-back.png',
    primaryPhone: '+9779812345678',
    secondaryPhone: null,
    permanentAddress: {
      street: 'Kathmandu-10',
      city: 'Kathmandu',
      district: 'Kathmandu',
      province: 'Bagmati',
      country: 'Nepal',
    },
    temporaryAddress: null,
    status: KycStatus.PENDING,
    rejectionReason: null,
    reviewedBy: null,
    reviewedAt: null,
    phoneOtpHash: null,
    phoneOtpExpiresAt: null,
    phoneOtpAttempts: 0,
    phoneVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

describe('KycService — phone OTP verification', () => {
  let mockKycRepository: {
    findKycByUserId: jest.Mock;
    findKycById: jest.Mock;
    saveKyc: jest.Mock;
    createKyc: jest.Mock;
    findBankByUserId: jest.Mock;
    createBank: jest.Mock;
    saveBank: jest.Mock;
  };
  let mockSmsService: { sendSms: jest.Mock };
  let mockUsersService: { findById: jest.Mock };
  let mockMailService: {
    sendKycApproved: jest.Mock;
    sendKycRejected: jest.Mock;
    sendKycReceived: jest.Mock;
  };
  let service: KycService;

  beforeEach(() => {
    mockKycRepository = {
      findKycByUserId: jest.fn(),
      findKycById: jest.fn(),
      saveKyc: jest.fn((kyc: KycVerification) => Promise.resolve(kyc)),
      createKyc: jest.fn((data: Partial<KycVerification>) => ({
        ...buildKyc(),
        ...data,
      })),
      findBankByUserId: jest.fn().mockResolvedValue(null),
      createBank: jest.fn((data: Record<string, unknown>) => data),
      saveBank: jest.fn((bank: Record<string, unknown>) =>
        Promise.resolve(bank),
      ),
    };
    mockSmsService = { sendSms: jest.fn().mockResolvedValue(undefined) };
    mockUsersService = { findById: jest.fn().mockResolvedValue(null) };
    mockMailService = {
      sendKycApproved: jest.fn().mockResolvedValue(undefined),
      sendKycRejected: jest.fn().mockResolvedValue(undefined),
      sendKycReceived: jest.fn().mockResolvedValue(undefined),
    };

    service = new KycService(
      mockKycRepository as never,
      { encrypt: jest.fn((v: string) => `enc(${v})`) } as never,
      {
        saveFile: jest.fn().mockResolvedValue('/some/path'),
        deleteFile: jest.fn().mockResolvedValue(undefined),
      } as never,
      mockMailService as never,
      mockUsersService as never,
      mockSmsService as never,
    );
  });

  describe('sendPhoneOtp', () => {
    it('throws if the caller has no KYC submission', async () => {
      mockKycRepository.findKycByUserId.mockResolvedValue(null);
      await expect(service.sendPhoneOtp('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if the phone is already verified', async () => {
      mockKycRepository.findKycByUserId.mockResolvedValue(
        buildKyc({ phoneVerifiedAt: new Date() }),
      );
      await expect(service.sendPhoneOtp('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('sends an SMS and persists the OTP hash + expiry', async () => {
      const kyc = buildKyc();
      mockKycRepository.findKycByUserId.mockResolvedValue(kyc);

      const result = await service.sendPhoneOtp('user-1');

      expect(mockSmsService.sendSms).toHaveBeenCalledTimes(1);
      const [to, text] = mockSmsService.sendSms.mock.calls[0] as [
        string,
        string,
      ];
      expect(to).toBe(kyc.primaryPhone);
      expect(text).toMatch(/\d{6}/);
      expect(kyc.phoneOtpHash).not.toBeNull();
      expect(kyc.phoneOtpExpiresAt).not.toBeNull();
      expect(kyc.phoneOtpAttempts).toBe(0);
      expect(result).toEqual({ message: 'Verification code sent' });
    });

    it('propagates the SMS gateway failure instead of persisting an OTP', async () => {
      mockKycRepository.findKycByUserId.mockResolvedValue(buildKyc());
      mockSmsService.sendSms.mockRejectedValue(new Error('Sparrow is down'));

      await expect(service.sendPhoneOtp('user-1')).rejects.toThrow(
        'Sparrow is down',
      );
    });
  });

  describe('verifyPhoneOtp', () => {
    it('verifies on a correct, unexpired code', async () => {
      const code = '123456';
      const kyc = buildKyc({
        phoneOtpHash: hashCode(code),
        phoneOtpExpiresAt: new Date(Date.now() + 60_000),
        phoneOtpAttempts: 0,
      });
      mockKycRepository.findKycByUserId.mockResolvedValue(kyc);

      const result = await service.verifyPhoneOtp('user-1', { code });

      expect(result).toEqual({ message: 'Phone number verified' });
      expect(kyc.phoneVerifiedAt).not.toBeNull();
      expect(kyc.phoneOtpHash).toBeNull();
      expect(kyc.phoneOtpExpiresAt).toBeNull();
    });

    it('is idempotent once already verified — does not check the code', async () => {
      const kyc = buildKyc({ phoneVerifiedAt: new Date() });
      mockKycRepository.findKycByUserId.mockResolvedValue(kyc);

      const result = await service.verifyPhoneOtp('user-1', {
        code: '000000',
      });

      expect(result).toEqual({ message: 'Phone number already verified' });
      expect(mockKycRepository.saveKyc).not.toHaveBeenCalled();
    });

    it('rejects an incorrect code and increments attempts', async () => {
      const kyc = buildKyc({
        phoneOtpHash: hashCode('123456'),
        phoneOtpExpiresAt: new Date(Date.now() + 60_000),
        phoneOtpAttempts: 0,
      });
      mockKycRepository.findKycByUserId.mockResolvedValue(kyc);

      await expect(
        service.verifyPhoneOtp('user-1', { code: '999999' }),
      ).rejects.toThrow(BadRequestException);
      expect(kyc.phoneOtpAttempts).toBe(1);
      expect(kyc.phoneVerifiedAt).toBeNull();
    });

    it('rejects once the max attempt count is reached', async () => {
      const kyc = buildKyc({
        phoneOtpHash: hashCode('123456'),
        phoneOtpExpiresAt: new Date(Date.now() + 60_000),
        phoneOtpAttempts: 5,
      });
      mockKycRepository.findKycByUserId.mockResolvedValue(kyc);

      await expect(
        service.verifyPhoneOtp('user-1', { code: '123456' }),
      ).rejects.toThrow('Too many incorrect attempts');
    });

    it('rejects an expired code', async () => {
      const kyc = buildKyc({
        phoneOtpHash: hashCode('123456'),
        phoneOtpExpiresAt: new Date(Date.now() - 1000),
        phoneOtpAttempts: 0,
      });
      mockKycRepository.findKycByUserId.mockResolvedValue(kyc);

      await expect(
        service.verifyPhoneOtp('user-1', { code: '123456' }),
      ).rejects.toThrow('expired');
    });

    it('rejects when no OTP was ever requested', async () => {
      mockKycRepository.findKycByUserId.mockResolvedValue(buildKyc());

      await expect(
        service.verifyPhoneOtp('user-1', { code: '123456' }),
      ).rejects.toThrow('No verification code requested');
    });
  });

  describe('reviewKyc — phone verification gate', () => {
    it('blocks APPROVE when the phone is not verified', async () => {
      mockKycRepository.findKycById.mockResolvedValue(
        buildKyc({ phoneVerifiedAt: null }),
      );

      await expect(
        service.reviewKyc('kyc-1', { action: ReviewAction.APPROVE }, 'admin-1'),
      ).rejects.toThrow('phone number is not verified');
    });

    it('allows APPROVE once the phone is verified', async () => {
      mockKycRepository.findKycById.mockResolvedValue(
        buildKyc({ phoneVerifiedAt: new Date() }),
      );

      const result = await service.reviewKyc(
        'kyc-1',
        { action: ReviewAction.APPROVE },
        'admin-1',
      );

      expect(result.status).toBe(KycStatus.APPROVED);
    });

    it('allows REJECT regardless of phone verification', async () => {
      mockKycRepository.findKycById.mockResolvedValue(
        buildKyc({ phoneVerifiedAt: null }),
      );

      const result = await service.reviewKyc(
        'kyc-1',
        { action: ReviewAction.REJECT, rejectionReason: 'Blurry document' },
        'admin-1',
      );

      expect(result.status).toBe(KycStatus.REJECTED);
    });
  });

  describe('submitKyc — phone verification carry-over on resubmission', () => {
    function buildDto(primaryPhone: string): SubmitKycDto {
      return {
        documentType: DocumentType.NID_CARD,
        primaryPhone,
        permanentAddressStreet: 'Kathmandu-10',
        permanentAddressCity: 'Kathmandu',
        permanentAddressDistrict: 'Kathmandu',
        permanentAddressProvince: 'Bagmati',
        bankName: 'Nepal Bank',
        accountHolderName: 'John Doe',
        accountNumber: '123456789',
        branch: 'Kathmandu Branch',
      };
    }

    const files = {
      nidFront: [{ buffer: Buffer.from('') } as Express.Multer.File],
      nidBack: [{ buffer: Buffer.from('') } as Express.Multer.File],
    };

    it('keeps phoneVerifiedAt when resubmitting with the same number', async () => {
      const verifiedAt = new Date('2026-01-01T00:00:00Z');
      const existing = buildKyc({
        status: KycStatus.REJECTED,
        phoneVerifiedAt: verifiedAt,
        primaryPhone: '+9779812345678',
      });
      mockKycRepository.findKycByUserId.mockResolvedValue(existing);

      await service.submitKyc('user-1', buildDto('+9779812345678'), files);

      expect(existing.phoneVerifiedAt).toEqual(verifiedAt);
      expect(mockSmsService.sendSms).not.toHaveBeenCalled();
    });

    it('resets phoneVerifiedAt and re-sends an OTP when the number changes', async () => {
      const existing = buildKyc({
        status: KycStatus.REJECTED,
        phoneVerifiedAt: new Date('2026-01-01T00:00:00Z'),
        primaryPhone: '+9779812345678',
      });
      mockKycRepository.findKycByUserId.mockResolvedValue(existing);

      await service.submitKyc('user-1', buildDto('+9779887654321'), files);

      expect(existing.phoneVerifiedAt).toBeNull();
      expect(mockSmsService.sendSms).toHaveBeenCalledTimes(1);
    });
  });
});
