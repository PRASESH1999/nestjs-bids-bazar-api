import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsBroadcastService } from './services/notifications-broadcast.service';
import { BidSubmittedNotificationHandler } from './handlers/bid-submitted-notification.handler';
import { AuctionClosedNotificationHandler } from './handlers/auction-closed-notification.handler';
import { AuctionSettledNotificationHandler } from './handlers/auction-settled-notification.handler';
import { WinTransferredNotificationHandler } from './handlers/win-transferred-notification.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    // Independent JWT registration (not imported from AuthModule, which
    // doesn't export JwtModule) — same RS256 key factory, used only to
    // mint/verify the short-lived SSE stream ticket.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        privateKey: configService
          .get<string>('JWT_PRIVATE_KEY')
          ?.replace(/\\n/g, '\n'),
        publicKey: configService
          .get<string>('JWT_PUBLIC_KEY')
          ?.replace(/\\n/g, '\n'),
        signOptions: {
          algorithm: 'RS256',
        },
      }),
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsBroadcastService,
    // Event handlers — registered as providers to receive @OnEvent dispatches.
    BidSubmittedNotificationHandler,
    AuctionClosedNotificationHandler,
    AuctionSettledNotificationHandler,
    WinTransferredNotificationHandler,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
