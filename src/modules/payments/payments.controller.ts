import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import { PaymentsService } from './services/payments.service';
import { GetBanksQueryDto, InitiatePaymentDto } from './dto/payment.dto';
import { ListPaymentsAdminQueryDto } from './dto/list-payments-admin.query.dto';
import { FonepayClientService } from '@modules/fonepay/services/fonepay-client.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(PermissionsGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly fonepayClientService: FonepayClientService,
  ) {}

  /**
   * Proxy the Fonepay bank list to the client.
   * Keeps Fonepay credentials server-side; client never touches Fonepay directly.
   * Optional `mobileNo` query param pre-filters banks that support the given number.
   */
  @Get(':productId/banks')
  @RequirePermissions(Permission.PAYMENT_INITIATE)
  @ApiOperation({ summary: 'List Fonepay-supported banks for Intent Checkout' })
  async getBanks(
    @Param('productId') _productId: string,
    @Query() query: GetBanksQueryDto,
  ) {
    return this.fonepayClientService.getBankList(query.mobileNo);
  }

  /**
   * Generate a Fonepay Intent QR for the calling user's winning bid on a product.
   * Returns qrString (desktop QR image), qrMessage (mobile deep link payload),
   * and paymentDeadline.
   */
  @Post(':productId/initiate')
  @RequirePermissions(Permission.PAYMENT_INITIATE)
  @ApiOperation({
    summary: 'Initiate Fonepay payment for a product the caller won',
  })
  async initiatePayment(
    @Param('productId') productId: string,
    @Body() dto: InitiatePaymentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.paymentsService.initiatePayment(
      productId,
      req.user.sub,
      dto.deliveryZone,
    );
  }

  /**
   * Manual status fallback — verifies with Fonepay and reconciles the Payment row.
   * Frontend calls this if the SSE stream drops or no event arrives within a timeout.
   */
  @Get(':productId/status')
  @RequirePermissions(Permission.PAYMENT_INITIATE)
  @ApiOperation({
    summary:
      'Get current payment status for a product (reconciles with Fonepay if PENDING)',
  })
  async getStatus(
    @Param('productId') productId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.paymentsService.getStatus(productId, req.user.sub);
  }

  /**
   * Admin payment-records page — every attempt, including FAILED/EXPIRED
   * ones, so admins can spot patterns in payment failures.
   */
  @Get('admin/all')
  @RequirePermissions(Permission.PAYMENT_VIEW_ALL)
  @ApiOperation({
    summary:
      'Admin: list all payment records with optional filters and pagination (includes failed/expired attempts)',
  })
  async listAllPayments(@Query() query: ListPaymentsAdminQueryDto) {
    return this.paymentsService.listAllPayments(query);
  }
}
