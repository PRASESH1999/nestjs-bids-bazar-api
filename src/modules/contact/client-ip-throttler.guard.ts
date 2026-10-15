import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Loopback, in each form Node reports it. The Next server usually sits here. */
const DEFAULT_TRUSTED_PROXIES = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

interface TrackedRequest {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Rate-limits by the visitor's IP rather than the caller's.
 *
 * The Contact form posts through a Next.js server action, so every request
 * reaches the API from the Next server's address — keyed on that, a per-IP
 * limit is one budget for the whole site. The server action passes the
 * visitor's address in `X-Forwarded-For`.
 *
 * That header is only believed when the request itself comes from a trusted
 * proxy (`TRUSTED_PROXY_IPS`, comma-separated; loopback by default). From
 * anywhere else it is ignored, or a spammer could name a fresh IP on every
 * request and never hit the limit.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: TrackedRequest): Promise<string> {
    const peer = req.ip ?? '';
    const trusted = (
      process.env.TRUSTED_PROXY_IPS?.split(',') ?? DEFAULT_TRUSTED_PROXIES
    )
      .map((ip) => ip.trim())
      .filter(Boolean);

    const header = req.headers['x-forwarded-for'];
    const forwarded = (Array.isArray(header) ? header[0] : header)
      ?.split(',')[0]
      ?.trim();

    return Promise.resolve(
      forwarded && trusted.includes(peer) ? forwarded : peer,
    );
  }
}
