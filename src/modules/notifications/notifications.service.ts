import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  CreateNotificationInput,
  NotificationsRepository,
} from './notifications.repository';
import { NotificationsBroadcastService } from './services/notifications-broadcast.service';
import { Notification } from './entities/notification.entity';
import { PaginatedResult } from '@common/types/paginated-result.type';
import { PaginationDto } from '@common/dto/pagination.dto';

const STREAM_TICKET_PURPOSE = 'notifications-stream';
const STREAM_TICKET_TTL_SECONDS = 60;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly broadcastService: NotificationsBroadcastService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Creates a notification and pushes it live to the recipient if connected.
   * Safe to call from a replayed event — a duplicate (userId, type, relatedId)
   * insert no-ops via the repository's unique-index catch, and the push is
   * skipped in that case since nothing new was created.
   */
  async createForUser(input: CreateNotificationInput): Promise<void> {
    const notification =
      await this.notificationsRepository.createIdempotent(input);
    if (!notification) return;

    try {
      this.broadcastService.push(input.userId, notification);
    } catch (err: unknown) {
      this.logger.error(
        `createForUser: SSE push failed for user ${input.userId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async findMyNotifications(
    userId: string,
    query: PaginationDto,
  ): Promise<PaginatedResult<Notification>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] =
      await this.notificationsRepository.findPaginatedForUser(
        userId,
        page,
        limit,
      );

    return { data, meta: { page, limit, total } };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationsRepository.countUnread(userId);
    return { count };
  }

  async markAsRead(userId: string, id: string): Promise<void> {
    const updated = await this.notificationsRepository.markRead(id, userId);
    if (!updated) {
      throw new NotFoundException('Notification not found');
    }
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const updated = await this.notificationsRepository.markAllRead(userId);
    return { updated };
  }

  mintStreamTicket(userId: string): { ticket: string; expiresIn: number } {
    const ticket = this.jwtService.sign(
      { sub: userId, purpose: STREAM_TICKET_PURPOSE },
      { expiresIn: `${STREAM_TICKET_TTL_SECONDS}s` },
    );
    return { ticket, expiresIn: STREAM_TICKET_TTL_SECONDS };
  }

  async verifyStreamTicket(ticket: string): Promise<string> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        purpose: string;
      }>(ticket, { algorithms: ['RS256'] });

      if (payload.purpose !== STREAM_TICKET_PURPOSE) {
        throw new Error('Wrong ticket purpose');
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired stream ticket');
    }
  }

  streamFor(userId: string) {
    return this.broadcastService.streamFor(userId);
  }
}
