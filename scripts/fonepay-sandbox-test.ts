/**
 * SANDBOX SMOKE TEST — NOT COMMITTED TO PRODUCTION.
 * Run once against the Fonepay UAT sandbox to verify signature acceptance.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/fonepay-sandbox-test.ts
 *
 * Requires a valid .env (or .env.development) with FONEPAY_* vars set.
 * Remove or gate (NODE_ENV check) this file before going to production.
 */
import 'dotenv/config';
import * as crypto from 'crypto';
import axios from 'axios';

const BASE_URL = process.env.FONEPAY_BASE_URL!;
const BASE_PATH = process.env.FONEPAY_BASE_PATH!;
const USERNAME = process.env.FONEPAY_USERNAME!;
const PASSWORD = process.env.FONEPAY_PASSWORD!;
const TERMINAL_ID = process.env.FONEPAY_TERMINAL_ID!;
const PRIVATE_KEY_B64 = process.env.FONEPAY_PRIVATE_KEY!;

function sign(payload: string): string {
  const der = Buffer.from(PRIVATE_KEY_B64, 'base64');
  const key = crypto.createPrivateKey({
    key: der,
    format: 'der',
    type: 'pkcs8',
  });
  const s = crypto.createSign('RSA-SHA256');
  s.update(payload, 'utf8');
  s.end();
  return s.sign(key, 'base64');
}

async function run() {
  // ── Step 1: Login ─────────────────────────────────────────────────────────
  console.log('\n--- Step 1: Login ---');
  const loginBody = JSON.stringify({ username: USERNAME, password: PASSWORD });
  const loginSig = sign(loginBody);
  const basicAuth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

  const loginRes = await axios.post<{ accessToken: string }>(
    `${BASE_URL}${BASE_PATH}/login`,
    loginBody,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
        signature: loginSig,
      },
      transformRequest: [(d: string) => d],
    },
  );
  console.log('Login status:', loginRes.status);
  const accessToken: string = loginRes.data.accessToken;
  console.log('accessToken prefix:', accessToken.slice(0, 20) + '...');

  // ── Step 2: Bank list ─────────────────────────────────────────────────────
  console.log('\n--- Step 2: Bank list (signed empty string) ---');
  const bankSig = sign('');
  console.log('Signed empty string:', bankSig.slice(0, 40) + '...');

  const bankRes = await axios.get<{ bankDetails?: unknown[] }>(
    `${BASE_URL}${BASE_PATH}/banks/list`,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: accessToken,
        signature: bankSig,
        paymentMode: 'INTENT',
      },
    },
  );
  console.log('Bank list status:', bankRes.status);
  console.log('Banks received:', bankRes.data?.bankDetails?.length ?? 0);

  // ── Step 3: Generate intent QR ────────────────────────────────────────────
  console.log('\n--- Step 3: Generate intent QR ---');
  const refLabel = `TEST${Date.now().toString().slice(-20)}`
    .slice(0, 30)
    .replace(/\D/g, '0');
  const qrBody = JSON.stringify({
    amount: 1,
    billId: 'SMOKE-TEST-001',
    terminalId: TERMINAL_ID,
    paymentMode: 'QR',
    referenceLabel: refLabel,
    qrType: 'INTENT_QR',
  });
  const qrSig = sign(qrBody);

  const qrRes = await axios.post<{
    websocketId?: string;
    thirdpartyQRWebSocketUrl?: string;
  }>(`${BASE_URL}${BASE_PATH}/generate-intent-qr`, qrBody, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: accessToken,
      signature: qrSig,
    },
    transformRequest: [(d: string) => d],
  });
  console.log('QR status:', qrRes.status);
  console.log('QR fields:', Object.keys(qrRes.data));
  console.log(
    'websocketUrl:',
    qrRes.data.websocketId ??
      qrRes.data.thirdpartyQRWebSocketUrl ??
      'NOT PRESENT',
  );

  console.log('\n✓ All sandbox steps completed successfully.');
}

run().catch((err: unknown) => {
  const detail: unknown = axios.isAxiosError(err)
    ? (err.response?.data ?? err.message)
    : err instanceof Error
      ? err.message
      : String(err);
  console.error('Smoke test failed:', detail);
  process.exit(1);
});
