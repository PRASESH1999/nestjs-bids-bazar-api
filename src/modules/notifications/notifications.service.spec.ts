import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsBroadcastService } from './services/notifications-broadcast.service';
import { NotificationType } from '@common/enums/notification-type.enum';
import { Notification } from './entities/notification.entity';

// ── Mocks — module scope ────────────────────────────────────────────────────
const mockNotificationsRepository = {
  createIdempotent: jest.fn(),
  findPaginatedForUser: jest.fn(),
  countUnread: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
};

const mockBroadcastService = {
  streamFor: jest.fn(),
  push: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  verifyAsync: jest.fn(),
};

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: NotificationType.OUTBID,
    relatedId: 'bid-1',
    title: 'Title',
    message: 'Message',
    data: null,
    isRead: false,
    readAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Notification;
}

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(() => {
    service = new NotificationsService(
      mockNotificationsRepository as unknown as NotificationsRepository,
      mockBroadcastService as unknown as NotificationsBroadcastService,
      mockJwtService as unknown as JwtService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('createForUser', () => {
    const input = {
      userId: 'user-1',
      type: NotificationType.OUTBID,
      relatedId: 'bid-1',
      title: 'Title',
      message: 'Message',
    };

    it('pushes the created notification via the broadcast service', async () => {
      const notification = makeNotification();
      mockNotificationsRepository.createIdempotent.mockResolvedValue(
        notification,
      );

      await service.createForUser(input);

      expect(mockNotificationsRepository.createIdempotent).toHaveBeenCalledWith(
        input,
      );
      expect(mockBroadcastService.push).toHaveBeenCalledWith(
        'user-1',
        notification,
      );
    });

    it('does not push when the insert was a replay no-op (null returned)', async () => {
      mockNotificationsRepository.createIdempotent.mockResolvedValue(null);

      await service.createForUser(input);

      expect(mockBroadcastService.push).not.toHaveBeenCalled();
    });

    it('does not throw when the broadcast push itself fails', async () => {
      const notification = makeNotification();
      mockNotificationsRepository.createIdempotent.mockResolvedValue(
        notification,
      );
      mockBroadcastService.push.mockImplementation(() => {
        throw new Error('push failed');
      });

      await expect(service.createForUser(input)).resolves.toBeUndefined();
    });
  });

  describe('findMyNotifications', () => {
    it('returns a PaginatedResult built from the repository result', async () => {
      const notifications = [makeNotification(), makeNotification({ id: 'notif-2' })];
      mockNotificationsRepository.findPaginatedForUser.mockResolvedValue([
        notifications,
        2,
      ]);

      const result = await service.findMyNotifications('user-1', {
        page: 1,
        limit: 20,
      });

      expect(mockNotificationsRepository.findPaginatedForUser).toHaveBeenCalledWith(
        'user-1',
        1,
        20,
      );
      expect(result).toEqual({
        data: notifications,
        meta: { page: 1, limit: 20, total: 2 },
      });
    });

    it('defaults page/limit when not provided', async () => {
      mockNotificationsRepository.findPaginatedForUser.mockResolvedValue([[], 0]);

      await service.findMyNotifications('user-1', {});

      expect(mockNotificationsRepository.findPaginatedForUser).toHaveBeenCalledWith(
        'user-1',
        1,
        20,
      );
    });
  });

  describe('getUnreadCount', () => {
    it('returns the repository count wrapped in an object', async () => {
      mockNotificationsRepository.countUnread.mockResolvedValue(3);

      const result = await service.getUnreadCount('user-1');

      expect(result).toEqual({ count: 3 });
    });
  });

  describe('markAsRead', () => {
    it('resolves when the repository confirms a row was updated', async () => {
      mockNotificationsRepository.markRead.mockResolvedValue(true);

      await expect(
        service.markAsRead('user-1', 'notif-1'),
      ).resolves.toBeUndefined();
      expect(mockNotificationsRepository.markRead).toHaveBeenCalledWith(
        'notif-1',
        'user-1',
      );
    });

    it('throws NotFoundException when not found or not owned', async () => {
      mockNotificationsRepository.markRead.mockResolvedValue(false);

      await expect(
        service.markAsRead('user-1', 'notif-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('returns the number of rows updated', async () => {
      mockNotificationsRepository.markAllRead.mockResolvedValue(5);

      const result = await service.markAllAsRead('user-1');

      expect(result).toEqual({ updated: 5 });
    });
  });

  describe('mintStreamTicket / verifyStreamTicket', () => {
    it('mints a ticket with a 60s expiry and the stream-ticket purpose', () => {
      mockJwtService.sign.mockReturnValue('signed-ticket');

      const result = service.mintStreamTicket('user-1');

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-1', purpose: 'notifications-stream' },
        { expiresIn: '60s' },
      );
      expect(result).toEqual({ ticket: 'signed-ticket', expiresIn: 60 });
    });

    it('resolves the user id for a valid ticket', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        purpose: 'notifications-stream',
      });

      const userId = await service.verifyStreamTicket('valid-ticket');

      expect(userId).toBe('user-1');
    });

    it('throws UnauthorizedException when the purpose claim is wrong', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        purpose: 'something-else',
      });

      await expect(
        service.verifyStreamTicket('wrong-purpose-ticket'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the token fails verification', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('expired'));

      await expect(
        service.verifyStreamTicket('expired-ticket'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
