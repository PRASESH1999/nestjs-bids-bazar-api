import * as crypto from 'crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { PhoneVerificationService } from './phone-verification.service';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'BB000001-2026',
    email: 'u@test.local',
    password: null,
    googleId: null,
    facebookId: null,
    role: 'USER',
    isActive: true,
    isEmailVerified: true,
    hashedRefreshToken: null,
    phone: null,
    phoneVerifiedAt: null,
    phoneOtpHash: null,
    phoneOtpExpiresAt: null,
    phoneOtpAttempts: 0,
    pendingPhone: null,
    averageRating: 0,
    ratingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as User;
}

const hash = (code: string) =>
  crypto.createHash('sha256').update(code).digest('hex');

describe('PhoneVerificationService', () => {
  let repo: { findOne: jest.Mock; save: jest.Mock };
  let sms: { sendSms: jest.Mock };
  let service: PhoneVerificationService;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn((u: User) => Promise.resolve(u)),
    };
    sms = { sendSms: jest.fn().mockResolvedValue(undefined) };
    service = new PhoneVerificationService(repo as never, sms as never);
  });

  describe('sendOtp', () => {
    it('refuses a number already verified on this account', async () => {
      repo.findOne.mockResolvedValueOnce(
        buildUser({ phone: '+9779800000001', phoneVerifiedAt: new Date() }),
      );

      await expect(
        service.sendOtp('user-1', { phone: '+9779800000001' }),
      ).rejects.toThrow(BadRequestException);
      expect(sms.sendSms).not.toHaveBeenCalled();
    });

    it('refuses a number held by another account', async () => {
      repo.findOne
        .mockResolvedValueOnce(buildUser())
        .mockResolvedValueOnce(buildUser({ id: 'someone-else' }));

      await expect(
        service.sendOtp('user-1', { phone: '+9779800000002' }),
      ).rejects.toThrow(ConflictException);
      expect(sms.sendSms).not.toHaveBeenCalled();
    });

    it('holds the new number as pending, leaving a verified one in place', async () => {
      const user = buildUser({
        phone: '+9779800000001',
        phoneVerifiedAt: new Date(),
      });
      repo.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce(null);

      await service.sendOtp('user-1', { phone: '+9779800000009' });

      const saved = repo.save.mock.calls[0][0] as User;
      // The verified number survives an unconfirmed change request — losing it
      // here would mean a mistyped number cost you the one you already had.
      expect(saved.phone).toBe('+9779800000001');
      expect(saved.pendingPhone).toBe('+9779800000009');
      expect(saved.phoneOtpHash).toEqual(expect.any(String));
      expect(saved.phoneOtpAttempts).toBe(0);
    });

    it('does not store a code it failed to send', async () => {
      repo.findOne
        .mockResolvedValueOnce(buildUser())
        .mockResolvedValueOnce(null);
      sms.sendSms.mockRejectedValue(new Error('sparrow down'));

      await expect(
        service.sendOtp('user-1', { phone: '+9779800000002' }),
      ).rejects.toThrow('sparrow down');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    const pending = (overrides: Partial<User> = {}) =>
      buildUser({
        pendingPhone: '+9779800000002',
        phoneOtpHash: hash('123456'),
        phoneOtpExpiresAt: new Date(Date.now() + 60_000),
        ...overrides,
      });

    it('rejects when no code was requested', async () => {
      repo.findOne.mockResolvedValueOnce(buildUser());
      await expect(
        service.verifyOtp('user-1', { code: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an expired code', async () => {
      repo.findOne.mockResolvedValueOnce(
        pending({ phoneOtpExpiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(
        service.verifyOtp('user-1', { code: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('counts a wrong code against the attempt limit', async () => {
      repo.findOne.mockResolvedValueOnce(pending());
      await expect(
        service.verifyOtp('user-1', { code: '000000' }),
      ).rejects.toThrow(BadRequestException);
      expect((repo.save.mock.calls[0][0] as User).phoneOtpAttempts).toBe(1);
    });

    it('refuses once the attempt limit is spent', async () => {
      repo.findOne.mockResolvedValueOnce(pending({ phoneOtpAttempts: 5 }));
      await expect(
        service.verifyOtp('user-1', { code: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('promotes the pending number and clears the OTP state', async () => {
      repo.findOne.mockResolvedValueOnce(pending()).mockResolvedValueOnce(null);

      const status = await service.verifyOtp('user-1', { code: '123456' });

      const saved = repo.save.mock.calls[0][0] as User;
      expect(saved.phone).toBe('+9779800000002');
      expect(saved.phoneVerifiedAt).toEqual(expect.any(Date));
      expect(saved.pendingPhone).toBeNull();
      expect(saved.phoneOtpHash).toBeNull();
      expect(status.isPhoneVerified).toBe(true);
    });

    it('refuses to promote a number claimed while the code was outstanding', async () => {
      // Two accounts can hold a pending code for the same number; only the
      // first to confirm may keep it, so ownership is re-checked here and not
      // only when the code was requested.
      repo.findOne
        .mockResolvedValueOnce(pending())
        .mockResolvedValueOnce(buildUser({ id: 'someone-else' }));

      await expect(
        service.verifyOtp('user-1', { code: '123456' }),
      ).rejects.toThrow(ConflictException);
      expect((repo.save.mock.calls[0][0] as User).phone).toBeNull();
    });
  });
});
