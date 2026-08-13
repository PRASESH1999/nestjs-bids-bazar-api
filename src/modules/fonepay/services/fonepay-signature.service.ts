import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class FonepaySignatureService implements OnModuleInit {
  private privateKey: crypto.KeyObject;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const base64Key = this.configService.getOrThrow<string>(
      'FONEPAY_PRIVATE_KEY',
    );
    try {
      const der = Buffer.from(base64Key, 'base64');
      this.privateKey = crypto.createPrivateKey({
        key: der,
        format: 'der',
        type: 'pkcs8',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `FonepaySignatureService: FONEPAY_PRIVATE_KEY is not a valid PKCS#8 DER key — ${message}`,
      );
    }
  }

  /**
   * Sign `payload` with RSA-SHA256 (RSASSA-PKCS1-v1_5 + SHA-256).
   *
   * CRITICAL: the caller must pass the EXACT string that will be sent as the
   * HTTP body. Build the body string once, call sign() with it, then send that
   * same string as the body. Calling JSON.stringify twice can reorder keys and
   * produce a signature mismatch.
   *
   * For GET requests with no body, pass an empty string "".
   */
  sign(payload: string): string {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(payload, 'utf8');
    signer.end();
    return signer.sign(this.privateKey, 'base64');
  }
}
