import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  BadRequestException,
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // CORS allow-list is env-driven so deployments only change config, not code.
  // CORS_ORIGINS is a comma-separated list of allowed browser origins; when
  // unset it falls back to APP_FRONTEND_URL (single origin).
  const corsOrigins = configService
    .get<string>(
      'CORS_ORIGINS',
      configService.get<string>('APP_FRONTEND_URL', 'http://localhost:3001'),
    )
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // A silently wrong allow-list is invisible until a browser refuses a request,
  // and the failure surfaces in the browser console rather than in these logs —
  // so it gets printed at startup. `.env.development` overriding `.env` with
  // stale ports is exactly how the SSE streams sat broken (OPEN-ITEMS A24).
  new Logger('Bootstrap').log(`CORS allow-list: ${corsOrigins.join(', ')}`);

  const prefix = configService.get<string>('API_PREFIX', 'api');
  const version = configService.get<string>('API_VERSION', 'v1');

  app.setGlobalPrefix(`${prefix}/${version}`);

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Bids Bazar API')
    .setDescription('The Bids Bazar Auction API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${prefix}/${version}/docs`, app, document);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const fields = errors.map((err) => ({
          field: err.property,
          message: Object.values(err.constraints || {}).join(', '),
        }));
        return new BadRequestException({
          errorCode: 'VALIDATION_FAILED',
          message: 'Request validation failed.',
          fields,
        });
      },
    }),
  );

  /*
   * Strips every `@Exclude()`-marked property on the way out — which is where
   * the credential hashes on `User` are caught (see the entity). Registered
   * globally rather than per-controller on purpose: the endpoints that leaked
   * them did so by returning an entity with a joined User relation, and any
   * future endpoint that does the same is covered without anyone remembering.
   *
   * `excludeExtraneousValues` is deliberately NOT set — that would require an
   * `@Expose()` on every field of every entity and would silently blank most
   * responses.
   */
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector), {
      // Decimal columns arrive from pg as strings; leave every value alone and
      // only act on the exclusions.
      enableImplicitConversion: false,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}
void bootstrap();
