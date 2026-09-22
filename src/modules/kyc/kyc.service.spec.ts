import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DocumentType } from '@common/enums/document-type.enum';
import { KycStatus } from '@common/enums/kyc-status.enum';
import { KycVerification } from './entities/kyc-verification.entity';
import { KycService, type KycFiles } from './kyc.service';
import { ReviewAction } from './dto/review-kyc.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';

function buildKyc(overrides: Partial<KycVerification> = {}): KycVerification {
  return {
    id: 'kyc-1',
    userId: 'user-1',
    fullName: 'Lily Shrestha',
    documentType: DocumentType.NID_CARD,
    documentId: 'NID-001',
    citizenshipFrontPath: null,
    citizenshipBackPath: null,
    passportPath: null,
    nidFrontPath: '/nid-front.png',
    emergencyContactPhone: null,
    permanentAddress: {
      street: 'Kathmandu-10',
      city: 'Kathmandu',
      district: 'Kathmandu',
      province: 'Bagmati',
      country: 'Nepal',
    },
    temporaryAddress: null,
    remarks: null,
    status: KycStatus.PENDING,
    rejectionReason: null,
    rejectedFields: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildDto(overrides: Partial<SubmitKycDto> = {}): SubmitKycDto {
  return {
    fullName: 'Lily Shrestha',
    documentType: DocumentType.NID_CARD,
    documentId: 'NID-001',
    permanentAddressStreet: 'Kathmandu-10',
    permanentAddressCity: 'Kathmandu',
    permanentAddressDistrict: 'Kathmandu',
    permanentAddressProvince: 'Bagmati',
    bankName: 'Nepal Bank',
    accountHolderName: 'Lily Shrestha',
    accountNumber: '1234567890',
    branch: 'Kathmandu',
    ...overrides,
  };
}

function fakeFile(name: string): Express.Multer.File {
  return { originalname: name } as Express.Multer.File;
}

describe('KycService.submitKyc', () => {
  let repo: {
    findKycByUserId: jest.Mock;
    findKycById: jest.Mock;
    findByDocumentIdentity: jest.Mock;
    saveKyc: jest.Mock;
    createKyc: jest.Mock;
    findBankByUserId: jest.Mock;
    createBank: jest.Mock;
    saveBank: jest.Mock;
  };
  let storage: { saveFile: jest.Mock; deleteFile: jest.Mock };
  let users: { findById: jest.Mock };
  let mail: {
    sendKycApproved: jest.Mock;
    sendKycRejected: jest.Mock;
    sendKycReceived: jest.Mock;
  };
  let service: KycService;

  const verifiedUser = {
    id: 'user-1',
    email: 'u@test.local',
    username: 'BB000001-2026',
    phoneVerifiedAt: new Date(),
  };

  beforeEach(() => {
    repo = {
      findKycByUserId: jest.fn().mockResolvedValue(null),
      findKycById: jest.fn(),
      findByDocumentIdentity: jest.fn().mockResolvedValue(null),
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
    storage = {
      saveFile: jest
        .fn()
        .mockImplementation((_f, _u, prefix: string) =>
          Promise.resolve(`/uploads/${prefix}.png`),
        ),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    users = { findById: jest.fn().mockResolvedValue(verifiedUser) };
    mail = {
      sendKycApproved: jest.fn().mockResolvedValue(undefined),
      sendKycRejected: jest.fn().mockResolvedValue(undefined),
      sendKycReceived: jest.fn().mockResolvedValue(undefined),
    };

    service = new KycService(
      repo as never,
      { encrypt: jest.fn((v: string) => `enc(${v})`) } as never,
      storage as never,
      mail as never,
      users as never,
    );
  });

  // ─── The phone gate ───────────────────────────────────────────────────────

  it('refuses a submission from an account with no verified phone', async () => {
    users.findById.mockResolvedValue({
      ...verifiedUser,
      phoneVerifiedAt: null,
    });

    await expect(
      service.submitKyc('user-1', buildDto(), {
        nidFront: [fakeFile('nid.png')],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── One document, one account ────────────────────────────────────────────

  it('refuses a document already registered to someone else', async () => {
    repo.findByDocumentIdentity.mockResolvedValue(
      buildKyc({ userId: 'someone-else' }),
    );

    await expect(
      service.submitKyc('user-1', buildDto(), {
        nidFront: [fakeFile('nid.png')],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('allows resubmitting the same document the caller already holds', async () => {
    const existing = buildKyc({ status: KycStatus.REJECTED });
    repo.findKycByUserId.mockResolvedValue(existing);
    repo.findByDocumentIdentity.mockResolvedValue(existing);

    await expect(
      service.submitKyc('user-1', buildDto(), {}),
    ).resolves.toMatchObject({ status: KycStatus.PENDING });
  });

  // ─── First submission requires every file ─────────────────────────────────

  it('requires the document files on a first submission', async () => {
    await expect(service.submitKyc('user-1', buildDto(), {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('names the missing slots for CITIZENSHIP', async () => {
    const dto = buildDto({
      documentType: DocumentType.CITIZENSHIP,
      documentId: 'CTZ-1',
    });
    await expect(
      service.submitKyc('user-1', dto, {
        citizenshipFront: [fakeFile('front.png')],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.stringContaining('citizenshipBack') as unknown,
      }) as unknown,
    });
  });

  // ─── Resubmission keeps what it is not given ──────────────────────────────

  it('keeps the existing document when the slot is omitted on a resubmission', async () => {
    repo.findKycByUserId.mockResolvedValue(
      buildKyc({ status: KycStatus.REJECTED, nidFrontPath: '/old-nid.png' }),
    );

    await service.submitKyc('user-1', buildDto(), {});

    expect(storage.saveFile).not.toHaveBeenCalled();
    expect(repo.saveKyc).toHaveBeenCalledWith(
      expect.objectContaining({ nidFrontPath: '/old-nid.png' }),
    );
    // The retained file must not be deleted as if it had been superseded.
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });

  it('replaces only the slot that was re-uploaded, and deletes just the old one', async () => {
    repo.findKycByUserId.mockResolvedValue(
      buildKyc({
        status: KycStatus.REJECTED,
        documentType: DocumentType.CITIZENSHIP,
        documentId: 'CTZ-1',
        citizenshipFrontPath: '/old-front.png',
        citizenshipBackPath: '/old-back.png',
        nidFrontPath: null,
      }),
    );

    await service.submitKyc(
      'user-1',
      buildDto({ documentType: DocumentType.CITIZENSHIP, documentId: 'CTZ-1' }),
      { citizenshipBack: [fakeFile('back.png')] },
    );

    expect(repo.saveKyc).toHaveBeenCalledWith(
      expect.objectContaining({
        citizenshipFrontPath: '/old-front.png',
        citizenshipBackPath: '/uploads/citizenship-back.png',
      }),
    );
    expect(storage.deleteFile).toHaveBeenCalledTimes(1);
    expect(storage.deleteFile).toHaveBeenCalledWith('/old-back.png');
  });

  it('carries nothing over when the document type changes', async () => {
    repo.findKycByUserId.mockResolvedValue(
      buildKyc({ status: KycStatus.REJECTED, nidFrontPath: '/old-nid.png' }),
    );

    // Switching NID → PASSPORT with no passport file has nothing to fall back on.
    await expect(
      service.submitKyc(
        'user-1',
        buildDto({ documentType: DocumentType.PASSPORT, documentId: 'P-1' }),
        {},
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── Write before delete ──────────────────────────────────────────────────

  it('leaves the old files intact when an upload fails part-way', async () => {
    repo.findKycByUserId.mockResolvedValue(
      buildKyc({
        status: KycStatus.REJECTED,
        documentType: DocumentType.CITIZENSHIP,
        documentId: 'CTZ-1',
        citizenshipFrontPath: '/old-front.png',
        citizenshipBackPath: '/old-back.png',
        nidFrontPath: null,
      }),
    );
    storage.saveFile
      .mockResolvedValueOnce('/uploads/citizenship-front.png')
      .mockRejectedValueOnce(new Error('disk full'));

    const files: KycFiles = {
      citizenshipFront: [fakeFile('front.png')],
      citizenshipBack: [fakeFile('back.png')],
    };

    await expect(
      service.submitKyc(
        'user-1',
        buildDto({
          documentType: DocumentType.CITIZENSHIP,
          documentId: 'CTZ-1',
        }),
        files,
      ),
    ).rejects.toThrow('disk full');

    // The record is untouched, and only the half-written new file is cleaned up.
    expect(repo.saveKyc).not.toHaveBeenCalled();
    expect(storage.deleteFile).toHaveBeenCalledWith(
      '/uploads/citizenship-front.png',
    );
    expect(storage.deleteFile).not.toHaveBeenCalledWith('/old-front.png');
    expect(storage.deleteFile).not.toHaveBeenCalledWith('/old-back.png');
  });

  // ─── A resubmission is a fresh application ────────────────────────────────

  it('clears the previous verdict and its flagged fields', async () => {
    repo.findKycByUserId.mockResolvedValue(
      buildKyc({
        status: KycStatus.REJECTED,
        rejectionReason: 'Blurry photo',
        rejectedFields: ['nidFront'],
      }),
    );

    await service.submitKyc('user-1', buildDto(), {});

    expect(repo.saveKyc).toHaveBeenCalledWith(
      expect.objectContaining({
        status: KycStatus.PENDING,
        rejectionReason: null,
        rejectedFields: null,
      }),
    );
  });
});

describe('KycService.reviewKyc', () => {
  let repo: { findKycById: jest.Mock; saveKyc: jest.Mock };
  let users: { findById: jest.Mock };
  let mail: { sendKycApproved: jest.Mock; sendKycRejected: jest.Mock };
  let service: KycService;

  beforeEach(() => {
    repo = {
      findKycById: jest.fn().mockResolvedValue(buildKyc()),
      saveKyc: jest.fn((kyc: KycVerification) => Promise.resolve(kyc)),
    };
    users = { findById: jest.fn() };
    mail = {
      sendKycApproved: jest.fn().mockResolvedValue(undefined),
      sendKycRejected: jest.fn().mockResolvedValue(undefined),
    };
    service = new KycService(
      repo as never,
      {} as never,
      {} as never,
      mail as never,
      users as never,
    );
  });

  it('refuses to approve while the applicant’s phone is unverified', async () => {
    users.findById.mockResolvedValue({
      id: 'user-1',
      email: 'u@test.local',
      username: 'BB000001-2026',
      phoneVerifiedAt: null,
    });

    await expect(
      service.reviewKyc('kyc-1', { action: ReviewAction.APPROVE }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('records the flagged fields on a rejection', async () => {
    users.findById.mockResolvedValue({
      id: 'user-1',
      email: 'u@test.local',
      username: 'BB000001-2026',
      phoneVerifiedAt: new Date(),
    });

    await service.reviewKyc(
      'kyc-1',
      {
        action: ReviewAction.REJECT,
        rejectionReason: 'Photo unreadable',
        rejectedFields: ['nidFront'],
      },
      'admin-1',
    );

    expect(repo.saveKyc).toHaveBeenCalledWith(
      expect.objectContaining({
        status: KycStatus.REJECTED,
        rejectedFields: ['nidFront'],
      }),
    );
  });

  it('clears any previous flags on an approval', async () => {
    repo.findKycById.mockResolvedValue(
      buildKyc({ rejectedFields: ['nidFront'], rejectionReason: 'old' }),
    );
    users.findById.mockResolvedValue({
      id: 'user-1',
      email: 'u@test.local',
      username: 'BB000001-2026',
      phoneVerifiedAt: new Date(),
    });

    await service.reviewKyc(
      'kyc-1',
      { action: ReviewAction.APPROVE },
      'admin-1',
    );

    expect(repo.saveKyc).toHaveBeenCalledWith(
      expect.objectContaining({
        status: KycStatus.APPROVED,
        rejectionReason: null,
        rejectedFields: null,
      }),
    );
  });

  it('addresses the applicant by handle, never by the name under review', async () => {
    users.findById.mockResolvedValue({
      id: 'user-1',
      email: 'u@test.local',
      username: 'BB000001-2026',
      phoneVerifiedAt: new Date(),
    });

    await service.reviewKyc(
      'kyc-1',
      { action: ReviewAction.APPROVE },
      'admin-1',
    );

    expect(mail.sendKycApproved).toHaveBeenCalledWith(
      'u@test.local',
      'BB000001-2026',
    );
  });

  it('404s on an unknown record', async () => {
    repo.findKycById.mockResolvedValue(null);
    await expect(
      service.reviewKyc('nope', { action: ReviewAction.APPROVE }, 'admin-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
