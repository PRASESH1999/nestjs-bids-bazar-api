// ─── Bank list ────────────────────────────────────────────────────────────────

export interface BankDetail {
  bankName: string;
  bankCode: string;
  bankIcon: string;
  packageName: string;
  intentScheme: string;
}

// ─── Generate intent QR ───────────────────────────────────────────────────────

export interface GenerateIntentQrInput {
  amount: number;
  billId: string;
  referenceLabel: string;
  terminalId?: string;
}

/** Raw shape returned by Fonepay's /generate-intent-qr — fields are optional/inconsistent across samples. */
export interface GenerateIntentQrRawResponse {
  qrString?: string;
  qrMessage?: string;
  qrDisplayName?: string;
  status?: string;
  terminalId?: string;
  prn?: string;
  websocketId?: string;
  thirdpartyQRWebSocketUrl?: string;
  terminalName?: string;
  location?: string;
  fonepayPanNumber?: string;
}

export interface IntentQrResponse {
  qrString: string;
  qrMessage: string;
  qrDisplayName: string;
  status: string;
  terminalId: string;
  prn: string;
  /** Mapped from `websocketId` or `thirdpartyQRWebSocketUrl` depending on response variant. */
  websocketUrl: string | null;
  terminalName: string;
  location: string;
  fonepayPanNumber: string;
}

// ─── Payment status ───────────────────────────────────────────────────────────

export interface GetPaymentStatusInput {
  referenceLabel: string;
  terminalId?: string;
}

export interface FonepayPaymentStatusResponse {
  prn: string;
  merchantCode: string;
  paymentStatus: 'success' | 'pending' | 'failed';
  fonepayTraceId: string;
  requestedAmount: number;
  totalTransactionAmount: number;
  paymentMessage: string;
}
