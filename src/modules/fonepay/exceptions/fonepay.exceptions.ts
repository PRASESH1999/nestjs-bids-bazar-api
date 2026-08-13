export class FonepayConflictException extends Error {
  constructor(
    message: string,
    public readonly fonepayMessage?: unknown,
  ) {
    super(message);
    this.name = 'FonepayConflictException';
  }
}

export class FonepayValidationException extends Error {
  constructor(
    message: string,
    public readonly fonepayErrors?: unknown,
  ) {
    super(message);
    this.name = 'FonepayValidationException';
  }
}

export class FonepayServerException extends Error {
  constructor(
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'FonepayServerException';
  }
}

export class FonepayUnavailableException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FonepayUnavailableException';
  }
}
