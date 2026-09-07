import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface SparrowSmsResponse {
  response_code: number;
  response: string;
  count?: number;
}

/**
 * Thin wrapper around the Sparrow SMS v2 API (https://docs.sparrowsms.com/sms/outgoing_sendsms/).
 * Sparrow only relays the message — it has no OTP concept of its own, so all
 * code generation/expiry/verification logic lives in the calling module.
 */
@Injectable()
export class SparrowSmsService {
  private readonly logger = new Logger(SparrowSmsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async sendSms(to: string, text: string): Promise<void> {
    const token = this.configService.getOrThrow<string>('SPARROW_SMS_TOKEN');
    const from = this.configService.getOrThrow<string>('SPARROW_SMS_FROM');
    const baseUrl = this.configService.getOrThrow<string>(
      'SPARROW_SMS_BASE_URL',
    );

    let data: SparrowSmsResponse;
    try {
      const response = await firstValueFrom(
        this.httpService.get<SparrowSmsResponse>(baseUrl, {
          params: { token, from, to, text },
          timeout: 10_000,
        }),
      );
      data = response.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Sparrow SMS request failed for ${to}: ${message}`);
      throw new ServiceUnavailableException(
        'Failed to send SMS. Please try again shortly.',
      );
    }

    if (data.response_code !== 200) {
      this.logger.error(
        `Sparrow SMS rejected message to ${to}: [${data.response_code}] ${data.response}`,
      );
      throw new ServiceUnavailableException(
        'Failed to send SMS. Please try again shortly.',
      );
    }
  }
}
