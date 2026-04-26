# Bootstrap Reference

> Read this before touching main.ts, app.module.ts, global pipes,
> interceptors, filters, guards, or any app-level configuration.
> This is the single source of truth for how the app is wired together.

---

## main.ts — Complete Implementation

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ── Logger ──────────────────────────────────────────────────────────
  // Replace NestJS default logger with Pino
  app.useLogger(app.get(Logger));

  // ── Config ──────────────────────────────────────────────────────────
  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 3000);
  const env = config.get<string>('app.env', 'development');
  const apiVersion = config.get<string>('app.apiVersion', 'v1');

  // ── Security ────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: config.get<string>('app.corsOrigin', '*'),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });

  // ── API Prefix & Versioning ──────────────────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: apiVersion,
  });

  // ── Global Pipes ────────────────────────────────────────────────────
  // Validates all DTOs globally — returns 400 with field-level errors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // Strip unknown fields silently
      forbidNonWhitelisted: false,  // Do not throw on unknown fields
      transform: true,              // Auto-transform DTOs (string → number etc.)
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        // Formats validation errors into standard envelope
        // GlobalExceptionFilter handles the rest
        return errors;
      },
    }),
  );

  // ── Global Filters ───────────────────────────────────────────────────
  // Must be registered before interceptors
  // Catches ALL exceptions and formats into { data, meta, error } envelope
  app.useGlobalFilters(app.get(GlobalExceptionFilter));

  // ── Global Interceptors ──────────────────────────────────────────────
  // Order matters — logging runs first, then response wrapping
  app.useGlobalInterceptors(
    app.get(LoggingInterceptor),    // Logs request/response, attaches requestId
    app.get(ResponseInterceptor),   // Wraps successful responses in envelope
  );

  // ── Swagger ──────────────────────────────────────────────────────────
  // Enabled in development and staging only — never production
  if (env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Bids Bazzar')
      .setDescription('English auction platform REST API')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addServer(`http://localhost:${port}`, 'Local')
      .addServer('https://staging.yourdomain.com', 'Staging')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/v1/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  // ── Graceful Shutdown ─────────────────────────────────────────────────
  app.enableShutdownHooks();

  process.on('unhandledRejection', (reason) => {
    // Never silently swallow — log and let PM2 handle restart if needed
    app.get(Logger).error('Unhandled Promise Rejection', { reason });
  });

  process.on('uncaughtException', (error) => {
    app.get(Logger).error('Uncaught Exception — shutting down', { error });
    process.exit(1);
  });

  // ── Start ─────────────────────────────────────────────────────────────
  await app.listen(port);
  app.get(Logger).log(
    `Bids Bazzar running on port ${port} in ${env} mode`,
    'Bootstrap',
  );
}

bootstrap();
```

---

## app.module.ts — Complete Implementation

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';
import { AppController } from './app.controller';
import appConfig from '@config/app.config';
import databaseConfig from '@config/database.config';
import jwtConfig from '@config/jwt.config';
import throttlerConfig from '@config/throttler.config';
import { configValidationSchema } from '@config/config.validation';
import { getDatabaseConfig } from '@config/database.config';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';

// Feature Modules
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { AuctionsModule } from '@modules/auctions/auctions.module';
import { BidsModule } from '@modules/bids/bids.module';

@Module({
  imports: [
    // ── Config (Global) ─────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, throttlerConfig],
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: false,
        abortEarly: false,   // Report ALL missing env vars at once
      },
    }),

    // ── Database (Global) ───────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),

    // ── Request Context (Global) ────────────────────────────────────────
    // nestjs-cls: provides correlation ID and user context across the stack
    // See references/cls-context.md for full usage
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,                    // Auto-mount on every request
        generateId: true,               // Auto-generate correlation ID
        idGenerator: () => uuidv4(),    // UUID v4 for every request
      },
    }),

    // ── Logging (Global) ────────────────────────────────────────────────
    // See references/logging.md for full configuration
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('app.logLevel', 'info'),
          transport:
            config.get('app.env') === 'development'
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
          // Never log sensitive fields
          redact: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.refreshToken',
          ],
          customProps: () => ({
            context: 'HTTP',
          }),
        },
      }),
    }),

    // ── Rate Limiting (Global) ───────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttler.ttl', 60000),
            limit: config.get<number>('throttler.limit', 100),
          },
        ],
      }),
    }),

    // ── Events (Global) ──────────────────────────────────────────────────
    // Interim in-process event emitter — replace when queue system decided
    // See references/events-queues.md
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),

    // ── Feature Modules ───────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    AuctionsModule,
    BidsModule,
  ],
  controllers: [AppController],
  providers: [
    // Global providers — injected via app.get() in main.ts
    GlobalExceptionFilter,
    ResponseInterceptor,
    LoggingInterceptor,
  ],
})
export class AppModule {}
```

---

## app.controller.ts — Health Check Only

```typescript
// src/app.controller.ts
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Get('health')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'App is healthy' })
  @ApiResponse({ status: 503, description: 'App is degraded' })
  async healthCheck(): Promise<object> {
    let dbStatus = 'ok';

    try {
      // Lightweight DB ping — never a full table scan
      await this.dataSource.query('SELECT 1');
    } catch {
      dbStatus = 'degraded';
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      version: process.env.npm_package_version ?? '1.0.0',
      env: this.config.get<string>('app.env'),
      uptime: Math.floor(process.uptime()),
      db: dbStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
```

---

## Global Exception Filter

```typescript
// src/common/filters/global-exception.filter.ts
import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';
import { ClsService } from 'nestjs-cls';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly cls: ClsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = this.cls.get('requestId') ?? 'unknown';

    const { statusCode, errorCode, message } =
      this.resolveException(exception);

    // Log with appropriate level
    const logContext = {
      requestId,
      method: request.method,
      url: request.url,
      statusCode,
      errorCode,
    };

    if (statusCode >= 500) {
      this.logger.error(message, exception instanceof Error
        ? exception.stack : undefined, logContext);
    } else {
      this.logger.warn(message, logContext);
    }

    // Always return standard { data, meta, error } envelope
    response.status(statusCode).json({
      data: null,
      meta: null,
      error: {
        code: errorCode,
        message,
        statusCode,
        // Include field errors for validation failures only
        ...(errorCode === 'VALIDATION_FAILED' && {
          fields: this.extractValidationFields(exception),
        }),
      },
    });
  }

  private resolveException(exception: unknown): {
    statusCode: number;
    errorCode: string;
    message: string;
  } {
    // NestJS HttpException (includes all custom domain exceptions)
    if (exception instanceof HttpException) {
      const response = exception.getResponse() as any;
      return {
        statusCode: exception.getStatus(),
        errorCode: response.errorCode ?? 'HTTP_ERROR',
        message: response.message ?? exception.message,
      };
    }

    // TypeORM — EntityNotFoundError
    if (exception instanceof EntityNotFoundError) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource was not found.',
      };
    }

    // TypeORM — QueryFailedError (PostgreSQL error codes)
    if (exception instanceof QueryFailedError) {
      return this.resolveQueryFailedError(exception);
    }

    // Unhandled — always 500, never expose internals
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    };
  }

  private resolveQueryFailedError(exception: QueryFailedError): {
    statusCode: number;
    errorCode: string;
    message: string;
  } {
    const pgCode = (exception as any).code;

    const pgErrorMap: Record<string, {
      statusCode: number;
      errorCode: string;
      message: string;
    }> = {
      '23505': {
        statusCode: HttpStatus.CONFLICT,
        errorCode: 'DUPLICATE_RESOURCE',
        message: 'A resource with this value already exists.',
      },
      '23503': {
        statusCode: HttpStatus.CONFLICT,
        errorCode: 'RESOURCE_REFERENCE_CONFLICT',
        message: 'This resource is referenced by another record.',
      },
      '23502': {
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'VALIDATION_FAILED',
        message: 'A required field is missing.',
      },
    };

    return pgErrorMap[pgCode] ?? {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'DATABASE_ERROR',
      message: 'A database error occurred. Please try again later.',
    };
  }

  private extractValidationFields(exception: unknown): Array<{
    field: string;
    message: string;
  }> {
    if (!(exception instanceof HttpException)) return [];
    const response = exception.getResponse() as any;
    if (!Array.isArray(response)) return [];

    return response.flatMap((error: any) =>
      Object.values(error.constraints ?? {}).map((msg) => ({
        field: error.property,
        message: msg as string,
      })),
    );
  }
}
```

---

## Response Interceptor

```typescript
// src/common/interceptors/response.interceptor.ts
import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  meta: PaginationMeta | null;
  error: null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If service already returned paginated shape, extract meta
        if (data && data.__paginated) {
          const { items, meta } = data;
          return { data: items, meta, error: null };
        }
        return { data, meta: null, error: null };
      }),
    );
  }
}
```

---

## Logging Interceptor

```typescript
// src/common/interceptors/logging.interceptor.ts
import {
  Injectable, NestInterceptor, ExecutionContext,
  CallHandler, Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ClsService } from 'nestjs-cls';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const requestId = this.cls.get<string>('requestId');
    const userId = this.cls.get<string>('userId') ?? null;
    const startTime = Date.now();

    // Attach requestId to response header
    response.setHeader('X-Request-Id', requestId);

    this.logger.log('Incoming request', {
      requestId,
      userId,
      method: request.method,
      url: request.url,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logger.log('Request completed', {
            requestId,
            userId,
            method: request.method,
            url: request.url,
            statusCode,
            responseTimeMs: responseTime,
          });

          // Warn on slow responses
          if (responseTime > 1000) {
            this.logger.warn('Slow response detected', {
              requestId,
              url: request.url,
              responseTimeMs: responseTime,
            });
          }
        },
        error: () => {
          const responseTime = Date.now() - startTime;
          this.logger.warn('Request failed', {
            requestId,
            userId,
            method: request.method,
            url: request.url,
            responseTimeMs: responseTime,
          });
        },
      }),
    );
  }
}
```

---

## Global Validation Pipe Config Rules
- `whitelist: true` — strips unknown fields silently, never throws
- `transform: true` — auto-transforms query param strings to correct types
- `forbidNonWhitelisted: false` — do not reject unknown fields, just strip
- `enableImplicitConversion: true` — handles `@Type()` transformations in DTOs

## Bootstrap Rules
- Global filter must be registered BEFORE global interceptors in main.ts
- GlobalExceptionFilter, ResponseInterceptor, LoggingInterceptor must be
  provided in AppModule.providers so they can be injected via app.get()
- Logger must be replaced before any other setup in bootstrap()
- Swagger must check NODE_ENV — never enabled in production
- CORS origin must come from ConfigService — never hardcoded
- Shutdown hooks must always be enabled for PM2 graceful restart
- unhandledRejection and uncaughtException must always be handled
- app.listen() is always the last line in bootstrap()