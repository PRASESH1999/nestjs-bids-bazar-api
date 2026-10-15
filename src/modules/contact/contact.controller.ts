import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@common/decorators/public.decorator';
import { R400, R429 } from '@common/swagger/api-responses';
import { ClientIpThrottlerGuard } from './client-ip-throttler.guard';
import { ContactService } from './contact.service';
import { SendContactMessageDto } from './dto/send-contact-message.dto';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Public()
  // The global ThrottlerGuard is disabled (app.module.ts), so the guard is
  // applied here: a public endpoint that sends mail is a spam relay without it.
  // Keyed on the visitor's IP, not the Next server's (see the guard).
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5/hour per visitor IP
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a Contact Us message to the support team',
    description:
      'Public. Emails the message to the support inbox (CONTACT_INBOX, else MAIL_FROM) with Reply-To set to the sender, and sends the sender a copy. Returns a ticket reference quoted in both subjects.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: { ticket: { type: 'string', example: 'BB-104382' } },
    },
  })
  @ApiResponse(R400)
  @ApiResponse(R429)
  @ApiResponse({
    status: 503,
    description: 'The support inbox could not be reached; nothing was sent.',
  })
  async send(@Body() dto: SendContactMessageDto) {
    return this.contactService.send(dto);
  }
}
