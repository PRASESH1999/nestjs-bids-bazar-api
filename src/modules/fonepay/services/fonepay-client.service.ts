import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  BankDetail,
  FonepayPaymentStatusResponse,
  GenerateIntentQrInput,
  GenerateIntentQrRawResponse,
  GetPaymentStatusInput,
  IntentQrResponse,
} from '../dto/fonepay.dto';
import {
  FonepayConflictException,
  FonepayServerException,
  FonepayUnavailableException,
  FonepayValidationException,
} from '../exceptions/fonepay.exceptions';
import { FonepayAuthService } from './fonepay-auth.service';
import { FonepaySignatureService } from './fonepay-signature.service';

@Injectable()
export class FonepayClientService {
  private readonly logger = new Logger(FonepayClientService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly signatureService: FonepaySignatureService,
    private readonly authService: FonepayAuthService,
  ) {}

  // ─── Bank list ─────────────────────────────────────────────────────────────

  /**
   * GET /banks/list
   *
   * The signed payload for this GET request is the EMPTY STRING — this is how
   * the Fonepay Postman pre-request script is written. The debug log below lets
   * you verify the 200 on first run against the sandbox.
   */
  async getBankList(
    mobileNo?: string,
    paymentMode = 'INTENT',
  ): Promise<BankDetail[]> {
    // Sign empty string for GET with no body
    const signedPayload = '';
    this.logger.debug(
      `getBankList: signing empty string, paymentMode=${paymentMode}`,
    );

    const extraHeaders: Record<string, string> = { paymentMode };
    if (mobileNo) extraHeaders.mobileNo = mobileNo;

    const raw = await this.request<{ bankDetails: BankDetail[] }>(
      'GET',
      '/banks/list',
      signedPayload,
      extraHeaders,
    );

    this.logger.debug(
      `getBankList: received ${raw.bankDetails?.length ?? 0} banks`,
    );
    return raw.bankDetails ?? [];
  }

  // ─── Generate intent QR ────────────────────────────────────────────────────

  async generateIntentQr(
    input: GenerateIntentQrInput,
  ): Promise<IntentQrResponse> {
    const terminalId =
      input.terminalId ??
      this.configService.getOrThrow<string>('FONEPAY_TERMINAL_ID');

    // Build body ONCE — this exact string is signed and sent.
    const bodyStr = JSON.stringify({
      amount: input.amount,
      billId: input.billId,
      terminalId,
      paymentMode: 'QR',
      referenceLabel: input.referenceLabel,
      qrType: 'INTENT_QR',
    });

    const raw = await this.request<GenerateIntentQrRawResponse>(
      'POST',
      '/generate-intent-qr',
      bodyStr,
    );

    return {
      qrString: raw.qrString ?? '',
      qrMessage: raw.qrMessage ?? '',
      qrDisplayName: raw.qrDisplayName ?? '',
      status: raw.status ?? '',
      terminalId: raw.terminalId ?? terminalId,
      prn: raw.prn ?? '',
      // Fonepay response field varies between samples; accept either.
      websocketUrl: raw.websocketId ?? raw.thirdpartyQRWebSocketUrl ?? null,
      terminalName: raw.terminalName ?? '',
      location: raw.location ?? '',
      fonepayPanNumber: raw.fonepayPanNumber ?? '',
    };
  }

  // ─── Payment status ────────────────────────────────────────────────────────

  async getPaymentStatus(
    input: GetPaymentStatusInput,
  ): Promise<FonepayPaymentStatusResponse> {
    const terminalId =
      input.terminalId ??
      this.configService.getOrThrow<string>('FONEPAY_TERMINAL_ID');

    const bodyStr = JSON.stringify({
      terminalId,
      referenceLabel: input.referenceLabel,
    });

    return this.request<FonepayPaymentStatusResponse>(
      'POST',
      '/thirdPartyDynamicQrGetStatus',
      bodyStr,
    );
  }

  // ─── Internal request helper ───────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    bodyStr = '',
    extraHeaders: Record<string, string> = {},
    isRetry = false,
  ): Promise<T> {
    const baseUrl = this.configService.getOrThrow<string>('FONEPAY_BASE_URL');
    const basePath = this.configService.getOrThrow<string>('FONEPAY_BASE_PATH');
    const url = `${baseUrl}${basePath}${endpoint}`;

    const signature = this.signatureService.sign(bodyStr);
    const authHeader = await this.authService.getAuthHeader();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      signature,
      ...extraHeaders,
    };

    try {
      const obs =
        method === 'GET'
          ? this.httpService.get<T>(url, { headers, timeout: 10_000 })
          : this.httpService.post<T>(url, bodyStr, {
              headers,
              timeout: 10_000,
              // Prevent axios from re-serialising the pre-built string.
              transformRequest: [(data: string) => data],
            });

      const response = await firstValueFrom(obs);
      return response.data;
    } catch (err: unknown) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;

      // 401 — evict the cached token and retry exactly once.
      if (status === 401 && !isRetry) {
        this.logger.warn(
          `${endpoint} returned 401, refreshing token and retrying`,
        );
        await this.authService.forceRefresh();
        return this.request<T>(method, endpoint, bodyStr, extraHeaders, true);
      }

      this.mapError(err, endpoint);
    }
  }

  private mapError(err: unknown, endpoint: string): never {
    const isAxios = axios.isAxiosError(err);
    const status: number | undefined = isAxios
      ? err.response?.status
      : undefined;
    const payload: unknown = isAxios ? err.response?.data : undefined;
    const rawMessage = err instanceof Error ? err.message : String(err);
    const message: string =
      (typeof payload === 'object' && payload !== null
        ? JSON.stringify(payload)
        : (payload as string | undefined)) ?? rawMessage;

    if (!status) {
      throw new FonepayUnavailableException(
        `Network or timeout error calling Fonepay ${endpoint}: ${rawMessage}`,
      );
    }

    switch (status) {
      case 400:
        throw new FonepayValidationException(message, payload);
      case 409:
        throw new FonepayConflictException(message, payload);
      case 500:
      default:
        throw new FonepayServerException(message, status);
    }
  }
}
