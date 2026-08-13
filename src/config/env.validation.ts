import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: Joi.number().default(3000),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  JWT_PUBLIC_KEY: Joi.string().required(),
  JWT_PRIVATE_KEY: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('7d'),
  ENCRYPTION_KEY: Joi.string().length(64).required(),
  UPLOAD_BASE_DIR: Joi.string().default('./uploads'),
  MAIL_HOST: Joi.string().required(),
  MAIL_PORT: Joi.number().required(),
  MAIL_USER: Joi.string().required(),
  MAIL_PASSWORD: Joi.string().required(),
  MAIL_FROM: Joi.string().required(),
  APP_FRONTEND_URL: Joi.string().uri().required(),
  // Comma-separated list of browser origins allowed by CORS. Optional — when
  // omitted, the server falls back to APP_FRONTEND_URL (see main.ts).
  CORS_ORIGINS: Joi.string().optional(),

  // Bidding & Auction Lifecycle
  BIDDING_DURATION_HOURS: Joi.number().integer().min(1).required(),
  PAYMENT_WINDOW_HOURS: Joi.number().integer().min(1).required(),
  BID_INCREMENT_MIN_FLAT: Joi.number().min(0.01).required(),
  BID_INCREMENT_PERCENT: Joi.number().min(0.001).max(1).required(),

  // Delivery (fixed, two-zone, cash on delivery)
  DELIVERY_CHARGE_INSIDE_VALLEY: Joi.number().min(0).required(),
  DELIVERY_CHARGE_OUTSIDE_VALLEY: Joi.number().min(0).required(),

  // Fonepay Intent Checkout
  FONEPAY_BASE_URL: Joi.string().uri().required(),
  FONEPAY_BASE_PATH: Joi.string().required(),
  FONEPAY_USERNAME: Joi.string().required(),
  FONEPAY_PASSWORD: Joi.string().required(),
  FONEPAY_TERMINAL_ID: Joi.string().max(16).required(),
  // PKCS#8 private key, base64-encoded, no PEM header/footer, single line.
  FONEPAY_PRIVATE_KEY: Joi.string().required(),
  // How long to trust a cached Fonepay access token before proactive re-login (minutes).
  FONEPAY_TOKEN_TTL_MINUTES: Joi.number().integer().min(1).default(10),
});
