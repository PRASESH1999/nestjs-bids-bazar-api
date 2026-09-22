import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { SparrowSmsService } from '@modules/sms/sparrow-sms.service';
import { User } from '../entities/user.entity';
import { SendPhoneOtpDto, VerifyPhoneOtpDto } from '../dto/phone.dto';

const PHONE_OTP_TTL_MS = 5 * 60 * 1000;
const PHONE_OTP_MAX_ATTEMPTS = 5;

export interface PhoneStatus {
  phone: string | null;
  isPhoneVerified: boolean;
  phoneVerifiedAt: string | null;
  /** A number awaiting confirmation, if a code is currently outstanding. */
  pendingPhone: string | null;
}

/**
 * Phone verification for the account itself.
 *
 * This used to hang off a KYC submission, which put it in the wrong order: a
 * seller had to submit their identity documents *before* they could prove the
 * number those documents were filed against. Verification now precedes KYC and
 * gates it (see KycService.submitKyc), so the number is established once and
 * reused.
 *
 * A verified number is never overwritten by an unconfirmed one: the pending
 * request is held in `pendingPhone` and only promoted to `phone` when the code
 * checks out. Requesting a code for a new number therefore cannot cost someone
 * the number they already have.
 */
@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly smsService: SparrowSmsService,
  ) {}

  async getStatus(userId: string): Promise<PhoneStatus> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.toStatus(user);
  }

  async sendOtp(
    userId: string,
    dto: SendPhoneOtpDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.phoneVerifiedAt && user.phone === dto.phone) {
      throw new BadRequestException('This number is already verified');
    }

    // The unique index would reject this at write time anyway; catching it here
    // means the caller gets an explanation rather than a constraint violation.
    const takenBySomeoneElse = await this.userRepo.findOne({
      where: { phone: dto.phone, id: Not(userId) },
      select: { id: true },
    });
    if (takenBySomeoneElse) {
      throw new ConflictException(
        'That number is already registered to another account',
      );
    }

    const code = crypto.randomInt(100000, 1000000).toString();

    // Sent before the hash is stored: if Sparrow fails, the previous pending
    // request stays valid rather than being replaced by a code nobody received.
    await this.smsService.sendSms(
      dto.phone,
      `Your BidsBazar phone verification code is ${code}. It expires in 5 minutes.`,
    );

    user.pendingPhone = dto.phone;
    user.phoneOtpHash = crypto.createHash('sha256').update(code).digest('hex');
    user.phoneOtpExpiresAt = new Date(Date.now() + PHONE_OTP_TTL_MS);
    user.phoneOtpAttempts = 0;
    await this.userRepo.save(user);

    return { message: 'Verification code sent' };
  }

  async verifyOtp(
    userId: string,
    dto: VerifyPhoneOtpDto,
  ): Promise<PhoneStatus> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!user.pendingPhone || !user.phoneOtpHash || !user.phoneOtpExpiresAt) {
      throw new BadRequestException(
        'No verification code requested. Please request one first.',
      );
    }
    if (user.phoneOtpExpiresAt < new Date()) {
      throw new BadRequestException(
        'Verification code has expired. Please request a new one.',
      );
    }
    if (user.phoneOtpAttempts >= PHONE_OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Too many incorrect attempts. Please request a new code.',
      );
    }

    const codeHash = crypto.createHash('sha256').update(dto.code).digest('hex');
    if (codeHash !== user.phoneOtpHash) {
      user.phoneOtpAttempts += 1;
      await this.userRepo.save(user);
      throw new BadRequestException('Incorrect verification code');
    }

    // Re-checked at promotion time, not only at request time: two accounts can
    // each hold a pending code for the same number, and only the first to
    // confirm it may keep it.
    const takenBySomeoneElse = await this.userRepo.findOne({
      where: { phone: user.pendingPhone, id: Not(userId) },
      select: { id: true },
    });
    if (takenBySomeoneElse) {
      user.pendingPhone = null;
      user.phoneOtpHash = null;
      user.phoneOtpExpiresAt = null;
      await this.userRepo.save(user);
      throw new ConflictException(
        'That number was registered to another account while this code was outstanding',
      );
    }

    user.phone = user.pendingPhone;
    user.phoneVerifiedAt = new Date();
    user.pendingPhone = null;
    user.phoneOtpHash = null;
    user.phoneOtpExpiresAt = null;
    user.phoneOtpAttempts = 0;
    const saved = await this.userRepo.save(user);

    return this.toStatus(saved);
  }

  private toStatus(user: User): PhoneStatus {
    return {
      phone: user.phone,
      isPhoneVerified: user.phoneVerifiedAt !== null,
      phoneVerifiedAt: user.phoneVerifiedAt
        ? user.phoneVerifiedAt.toISOString()
        : null,
      pendingPhone: user.pendingPhone,
    };
  }
}
