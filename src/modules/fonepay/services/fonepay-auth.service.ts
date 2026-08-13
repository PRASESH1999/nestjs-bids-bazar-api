import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import { firstValueFrom } from 'rxjs';
import { FonepaySignatureService } from './fonepay-signature.service';
import { FonepayUnavailableException } from '../exceptions/fonepay.exceptions';

@Injectable()
export class FonepayAuthService {
  private readonly logger = new Logger(FonepayAuthService.name);

  private cachedToken: string | null = null;
  private tokenFetchedAt: number | null = null;
  // Single-flight: if a login call is already in progress, other callers await
  // the same promise rather than spawning parallel logins.
  private loginInProgress: Promise<string> | null = null;

  private readonly tokenTtlMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly signatureService: FonepaySignatureService,
  ) {
    const ttlMinutes = this.configService.get<number>(
      'FONEPAY_TOKEN_TTL_MINUTES',
      10,
    );
    this.tokenTtlMs = ttlMinutes * 60 * 1000;
  }

  /** Returns the cached "Bearer ..." token, logging in if absent or expired. */
  async getAuthHeader(): Promise<string> {
    if (
      this.cachedToken &&
      this.tokenFetchedAt !== null &&
      Date.now() - this.tokenFetchedAt < this.tokenTtlMs
    ) {
      return this.cachedToken;
    }
    return this.doLogin();
  }

  /**
   * Evict the cached token and force a fresh login.
   * Called by FonepayClientService on a 401 response.
   */
  async forceRefresh(): Promise<string> {
    this.cachedToken = null;
    this.tokenFetchedAt = null;
    return this.doLogin();
  }

  private doLogin(): Promise<string> {
    if (this.loginInProgress) return this.loginInProgress;

    this.loginInProgress = this.performLogin().finally(() => {
      this.loginInProgress = null;
    });
    return this.loginInProgress;
  }

  private async performLogin(): Promise<string> {
    const baseUrl = this.configService.getOrThrow<string>('FONEPAY_BASE_URL');
    const basePath = this.configService.getOrThrow<string>('FONEPAY_BASE_PATH');
    const username = this.configService.getOrThrow<string>('FONEPAY_USERNAME');
    const password = this.configService.getOrThrow<string>('FONEPAY_PASSWORD');

    const url = `${baseUrl}${basePath}/login`;
    // Build the body string ONCE — sign this exact string and send this exact string.
    const bodyStr = JSON.stringify({ username, password });
    const signature = this.signatureService.sign(bodyStr);
    const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');

    try {
      const response = await firstValueFrom(
        this.httpService.post<{ accessToken: string }>(url, bodyStr, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${basicAuth}`,
            signature,
          },
          timeout: 10_000,
          // Send the raw string; axios must not re-serialize it.
          transformRequest: [(data: string) => data],
        }),
      );

      // Fonepay returns accessToken already prefixed with "Bearer ". Use verbatim.
      const token = response.data.accessToken;
      this.cachedToken = token;
      this.tokenFetchedAt = Date.now();
      this.logger.log('Fonepay login successful');
      return token;
    } catch (err: unknown) {
      const detail: unknown = axios.isAxiosError(err)
        ? (err.response?.data ?? err.message)
        : err instanceof Error
          ? err.message
          : String(err);
      this.logger.error('Fonepay login failed', detail);
      throw new FonepayUnavailableException(
        `Fonepay authentication failed: ${JSON.stringify(detail)}`,
      );
    }
  }
}
