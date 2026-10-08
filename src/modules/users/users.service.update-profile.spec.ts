import { ConflictException } from '@nestjs/common';
import { KycStatus } from '@common/enums/kyc-status.enum';
import { Role } from '@common/enums/role.enum';
import { User } from './entities/user.entity';
import { computeMissingProfileFields } from './profile-completion';
import { UsersService } from './users.service';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'BB000001-2026',
    email: 'u@test.local',
    fullName: 'Lily Shrestha',
    role: Role.USER,
    phone: null,
    phoneVerifiedAt: null,
    phoneOtpHash: null,
    phoneOtpExpiresAt: null,
    phoneOtpAttempts: 0,
    pendingPhone: '+9779800000001',
    ...overrides,
  } as User;
}

describe('UsersService.updateOwnProfile', () => {
  let usersRepository: {
    findById: jest.Mock;
    saveUser: jest.Mock<Promise<User>, [User]>;
    isPhoneTaken: jest.Mock;
  };
  let kycFindOne: jest.Mock;
  let service: UsersService;

  beforeEach(() => {
    usersRepository = {
      findById: jest.fn(),
      saveUser: jest.fn((u: User) => Promise.resolve(u)),
      isPhoneTaken: jest.fn().mockResolvedValue(false),
    };
    kycFindOne = jest.fn().mockResolvedValue(null);
    const dataSource = {
      getRepository: jest.fn(() => ({ findOne: kycFindOne })),
    };
    service = new UsersService(
      usersRepository as never,
      dataSource as never,
      {} as never,
      {} as never,
      {} as never,
    );
    // The returned profile isn't under test here — only what gets saved.
    jest.spyOn(service, 'getOwnProfile').mockResolvedValue({} as never);
  });

  const saved = () => usersRepository.saveUser.mock.calls[0][0];

  // ─── Name ─────────────────────────────────────────────────────────────────

  it('changes the name when there is no KYC yet', async () => {
    usersRepository.findById.mockResolvedValue(buildUser());

    await service.updateOwnProfile('user-1', { fullName: 'Ram Thapa' });

    expect(saved().fullName).toBe('Ram Thapa');
  });

  it('lets a rejected applicant correct their name', async () => {
    usersRepository.findById.mockResolvedValue(buildUser());
    kycFindOne.mockResolvedValue({ id: 'kyc-1', status: KycStatus.REJECTED });

    await service.updateOwnProfile('user-1', { fullName: 'Ram Thapa' });

    expect(saved().fullName).toBe('Ram Thapa');
  });

  it.each([KycStatus.PENDING, KycStatus.APPROVED])(
    'locks the name while KYC is %s',
    async (status) => {
      usersRepository.findById.mockResolvedValue(buildUser());
      kycFindOne.mockResolvedValue({ id: 'kyc-1', status });

      await expect(
        service.updateOwnProfile('user-1', { fullName: 'Ram Thapa' }),
      ).rejects.toThrow(ConflictException);
      expect(usersRepository.saveUser).not.toHaveBeenCalled();
    },
  );

  it('does not consult KYC when the name is unchanged', async () => {
    usersRepository.findById.mockResolvedValue(buildUser());

    await service.updateOwnProfile('user-1', { fullName: 'Lily Shrestha' });

    expect(kycFindOne).not.toHaveBeenCalled();
  });

  // ─── Phone ────────────────────────────────────────────────────────────────

  it('stores a new number as pending and discards the outstanding code', async () => {
    usersRepository.findById.mockResolvedValue(
      buildUser({
        phone: '+9779800000001',
        phoneVerifiedAt: new Date(),
        pendingPhone: '+9779800000002',
        phoneOtpHash: 'hash-of-code-sent-to-002',
        phoneOtpExpiresAt: new Date(Date.now() + 60_000),
        phoneOtpAttempts: 2,
      }),
    );

    await service.updateOwnProfile('user-1', { phone: '+9779800000003' });

    const user = saved();
    expect(user.phone).toBe('+9779800000001');
    expect(user.pendingPhone).toBe('+9779800000003');
    // A code sent to …002 must not be able to verify …003.
    expect(user.phoneOtpHash).toBeNull();
    expect(user.phoneOtpExpiresAt).toBeNull();
    expect(user.phoneOtpAttempts).toBe(0);
  });

  it('refuses a number verified on another account', async () => {
    usersRepository.findById.mockResolvedValue(buildUser());
    usersRepository.isPhoneTaken.mockResolvedValue(true);

    await expect(
      service.updateOwnProfile('user-1', { phone: '+9779800000009' }),
    ).rejects.toThrow(ConflictException);
    expect(usersRepository.saveUser).not.toHaveBeenCalled();
  });

  it('cancels a pending change when given back the verified number', async () => {
    usersRepository.findById.mockResolvedValue(
      buildUser({
        phone: '+9779800000001',
        phoneVerifiedAt: new Date(),
        pendingPhone: '+9779800000002',
      }),
    );

    await service.updateOwnProfile('user-1', { phone: '+9779800000001' });

    expect(saved().pendingPhone).toBeNull();
    expect(usersRepository.isPhoneTaken).not.toHaveBeenCalled();
  });
});

describe('computeMissingProfileFields', () => {
  it('is empty for a password registration (name + pending phone)', () => {
    expect(computeMissingProfileFields(buildUser())).toEqual([]);
  });

  it('asks a fresh social-login account for its phone', () => {
    expect(
      computeMissingProfileFields(buildUser({ pendingPhone: null })),
    ).toEqual(['phone']);
  });

  it('asks for both when the provider shared no name', () => {
    expect(
      computeMissingProfileFields(
        buildUser({ fullName: null, pendingPhone: null }),
      ),
    ).toEqual(['fullName', 'phone']);
  });

  it('exempts staff accounts', () => {
    expect(
      computeMissingProfileFields(
        buildUser({ role: Role.ADMIN, fullName: null, pendingPhone: null }),
      ),
    ).toEqual([]);
  });
});
