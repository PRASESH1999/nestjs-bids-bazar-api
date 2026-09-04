import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, filter, map } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import { Notification } from '../entities/notification.entity';

export interface NotificationCreatedEvent {
  type: 'notification.created';
  notification: Notification;
}

interface SubjectMessage {
  userId: string;
  payload: NotificationCreatedEvent;
}

/**
 * Per-user live-push broadcaster for the notifications SSE stream. Mirrors
 * AuctionBroadcastService (bidding module) exactly, keyed by userId instead
 * of productId — same single-instance-only in-memory Subject, same
 * accepted limitation per Rule 7 (scaling to multiple Node instances would
 * need this swapped for a pub/sub adapter, e.g. Redis).
 */
@Injectable()
export class NotificationsBroadcastService {
  private readonly logger = new Logger(NotificationsBroadcastService.name);

  private readonly subject = new Subject<SubjectMessage>();

  streamFor(userId: string): Observable<MessageEvent> {
    return this.subject.asObservable().pipe(
      filter((msg) => msg.userId === userId),
      map((msg): MessageEvent => ({ data: msg.payload })),
    );
  }

  push(userId: string, notification: Notification): void {
    this.subject.next({
      userId,
      payload: { type: 'notification.created', notification },
    });
    this.logger.debug(
      `push: pushed notification ${notification.id} to user ${userId}`,
    );
  }
}
