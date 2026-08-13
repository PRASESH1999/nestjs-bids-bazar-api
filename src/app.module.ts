import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// import { ThrottlerGuard } from '@nestjs/throttler';
import { CommonModule } from '@common/common.module';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { AuthModule } from '@modules/auth/auth.module';
import { BiddingModule } from '@modules/bidding/bidding.module';
import { CategoriesModule } from '@modules/categories/categories.module';
import { FonepayModule } from '@modules/fonepay/fonepay.module';
import { KycModule } from '@modules/kyc/kyc.module';
import { MailModule } from '@modules/mail/mail.module';
import { PaymentsModule } from '@modules/payments/payments.module';
import { ProductsModule } from '@modules/products/products.module';
import { RewardsModule } from '@modules/rewards/rewards.module';
import { UsersModule } from '@modules/users/users.module';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development', '.env'],
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        ssl: configService.get<string>('DB_SSL') === 'true',
        autoLoadEntities: true,
        synchronize: false,
        extra: {
          max: configService.get<number>('DB_POOL_MAX', 10),
        },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    CommonModule,
    UsersModule,
    AuthModule,
    KycModule,
    MailModule,
    CategoriesModule,
    ProductsModule,
    BiddingModule,
    PaymentsModule,
    FonepayModule,
    RewardsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Global JWT Guard
    },
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard, // Global Rate Limiter (Disabled for testing)
    // },
  ],
})
export class AppModule {}
