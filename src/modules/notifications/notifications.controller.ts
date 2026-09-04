import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Request,
  Sse,
  UseGuards,
  type MessageEvent,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable, concat, defer, from, map } from 'rxjs';
import { Public } from '@common/decorators/public.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import { PaginationDto } from '@common/dto/pagination.dto';
import { R401, R403, R404 } from '@common/swagger/api-responses';
import { ApiResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ─── USER: list own notifications ─────────────────────────────────────────

  @Get()
  @RequirePermissions(Permission.NOTIFICATION_VIEW_OWN)
  @ApiOperation({ summary: "Get the authenticated user's own notifications" })
  @ApiResponse(R401)
  @ApiResponse(R403)
  async getMyNotifications(
    @Request() req: RequestWithUser,
    @Query() query: PaginationDto,
  ) {
    return this.notificationsService.findMyNotifications(req.user.sub, query);
  }

  // ─── USER: unread count ────────────────────────────────────────────────────

  @Get('unread-count')
  @RequirePermissions(Permission.NOTIFICATION_VIEW_OWN)
  @ApiOperation({ summary: "Get the count of the user's unread notifications" })
  @ApiResponse(R401)
  @ApiResponse(R403)
  async getUnreadCount(@Request() req: RequestWithUser) {
    return this.notificationsService.getUnreadCount(req.user.sub);
  }

  // ─── USER: mark one notification read ──────────────────────────────────────

  @Patch(':id/read')
  @RequirePermissions(Permission.NOTIFICATION_VIEW_OWN)
  @ApiOperation({ summary: 'Mark a single notification as read (own only)' })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  async markAsRead(@Request() req: RequestWithUser, @Param('id') id: string) {
    await this.notificationsService.markAsRead(req.user.sub, id);
    return { success: true };
  }

  // ─── USER: mark all notifications read ─────────────────────────────────────

  @Patch('read-all')
  @RequirePermissions(Permission.NOTIFICATION_VIEW_OWN)
  @ApiOperation({ summary: "Mark all of the user's notifications as read" })
  @ApiResponse(R401)
  @ApiResponse(R403)
  async markAllAsRead(@Request() req: RequestWithUser) {
    return this.notificationsService.markAllAsRead(req.user.sub);
  }

  // ─── USER: mint a short-lived ticket for the SSE stream ────────────────────

  @Post('stream-ticket')
  @RequirePermissions(Permission.NOTIFICATION_VIEW_OWN)
  @ApiOperation({
    summary:
      'Mint a short-lived (60s) ticket used to authenticate the SSE stream connection, since EventSource cannot send an Authorization header',
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  mintStreamTicket(@Request() req: RequestWithUser) {
    return this.notificationsService.mintStreamTicket(req.user.sub);
  }

  // ─── PUBLIC: SSE live-notification stream ──────────────────────────────────

  @Sse('stream')
  @Public()
  @ApiOperation({
    summary:
      'Server-Sent Events stream of live notifications for the user identified by the ?ticket= query param (see POST /notifications/stream-ticket)',
  })
  async stream(
    @Query('ticket') ticket: string,
  ): Promise<Observable<MessageEvent>> {
    const userId = await this.notificationsService.verifyStreamTicket(ticket);

    // Initial snapshot — emitted once on connect so a freshly-connected
    // client can render the unread badge before the next live push arrives.
    const initial$ = defer(() =>
      from(this.notificationsService.getUnreadCount(userId)).pipe(
        map(
          (payload): MessageEvent => ({
            data: { type: 'notification.snapshot', ...payload },
          }),
        ),
      ),
    );

    return concat(initial$, this.notificationsService.streamFor(userId));
  }
}
