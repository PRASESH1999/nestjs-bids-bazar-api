import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationType } from '@common/enums/notification-type.enum';

interface PostgresQueryError extends QueryFailedError {
  code: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  relatedId: string;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
}

@Injectable()
export class NotificationsRepository {
  private readonly repo: Repository<Notification>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(Notification);
  }

  /**
   * Inserts a notification. Returns null on a duplicate-key replay (the
   * unique index on (userId, type, relatedId) is the idempotency guard) —
   * callers treat that as an already-delivered no-op, never an error.
   */
  async createIdempotent(
    data: CreateNotificationInput,
  ): Promise<Notification | null> {
    try {
      const entity = this.repo.create(data);
      return await this.repo.save(entity);
    } catch (err: unknown) {
      if (
        err instanceof QueryFailedError &&
        (err as PostgresQueryError).code === '23505'
      ) {
        return null;
      }
      throw err;
    }
  }

  async findPaginatedForUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<[Notification[], number]> {
    return this.repo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  countUnread(userId: string): Promise<number> {
    return this.repo.countBy({ userId, isRead: false });
  }

  /** Returns true only if a row was actually updated — owned AND unread. */
  async markRead(id: string, userId: string): Promise<boolean> {
    const result = await this.repo.update(
      { id, userId },
      { isRead: true, readAt: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.repo.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return result.affected ?? 0;
  }
}
