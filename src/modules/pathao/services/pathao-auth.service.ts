import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import { firstValueFrom } from 'rxjs';
import type { PathaoIssueTokenRawResponse } from '../dto/pathao.dto';

/**
 * Mirrors FonepayAuthService's cached-token + single-flight-login shape, but
 * Pathao returns a real `expires_in`/`refresh_token` (Fonepay does not), so
 * renewal uses the refresh_token grant instead of a fixed TTL re-login.
 */
@Injectable()
export class PathaoAuthService {
  private readonly logger = new Logger(PathaoAuthService.name);

  private cachedAccessToken: string | null = null;
  private cachedRefreshToken: string | null = null;
  // Epoch ms. A 5-minute safety margin is subtracted from Pathao's reported
  // expires_in so a call never starts mid-request with a token that expires
  // before the response arrives.
  private tokenExpiresAt: number | null = null;
  private loginInProgress: Promise<string> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /** Returns the cached "Bearer ..." header, logging in/refreshing if needed. */
  async getAuthHeader(): Promise<string> {
    if (
      this.cachedAccessToken &&
      this.tokenExpiresAt !== null &&
      Date.now() < this.tokenExpiresAt
    ) {
      return `Bearer ${this.cachedAccessToken}`;
    }
    const token = await this.login();
    return `Bearer ${token}`;
  }

  /** Evict the cached token and force a fresh login. Called on a 401. */
  async forceRefresh(): Promise<string> {
    this.cachedAccessToken = null;
    this.tokenExpiresAt = null;
    const token = await this.login();
    return `Bearer ${token}`;
  }

  private login(): Promise<string> {
    if (this.loginInProgress) return this.loginInProgress;
    this.loginInProgress = this.performLogin().finally(() => {
      this.loginInProgress = null;
    });
    return this.loginInProgress;
  }

  private async performLogin(): Promise<string> {
    const clientId = this.configService.getOrThrow<string>('PATHAO_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>(
      'PATHAO_CLIENT_SECRET',
    );

    if (this.cachedRefreshToken) {
      try {
        return await this.issueToken({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: this.cachedRefreshToken,
        });
      } catch (err: unknown) {
        this.logger.warn(
          `Pathao refresh_token grant failed, falling back to password grant: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        this.cachedRefreshToken = null;
      }
    }

    const username = this.configService.getOrThrow<string>('PATHAO_USERNAME');
    const password = this.configService.getOrThrow<string>('PATHAO_PASSWORD');
    return this.issueToken({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'password',
      username,
      password,
    });
  }

  private async issueToken(body: Record<string, string>): Promise<string> {
    const baseUrl = this.configService.getOrThrow<string>('PATHAO_BASE_URL');
    const url = `${baseUrl}/aladdin/api/v1/issue-token`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<PathaoIssueTokenRawResponse>(url, body, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10_000,
        }),
      );

      const data = response.data;
      this.cachedAccessToken = data.access_token;
      this.cachedRefreshToken = data.refresh_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
      this.logger.log(`Pathao ${body.grant_type} grant successful`);
      return data.access_token;
    } catch (err: unknown) {
      const detail: unknown = axios.isAxiosError(err)
        ? (err.response?.data ?? err.message)
        : err instanceof Error
          ? err.message
          : String(err);
      this.logger.error('Pathao authentication failed', detail);
      throw new ServiceUnavailableException(
        `Pathao authentication failed: ${JSON.stringify(detail)}`,
      );
    }
  }
}
