import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { MailService } from '@modules/mail/mail.service';
import type { ContactMessageTemplateParams } from '@modules/mail/templates/contact-message.template';
import {
  CONTACT_TOPIC_LABELS,
  type SendContactMessageDto,
} from './dto/send-contact-message.dto';

export interface ContactMessageReceipt {
  /** Quoted in both emails' subjects so a reply can be matched to the message. */
  ticket: string;
}

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly mailService: MailService) {}

  /**
   * Forward a Contact Us message to the support inbox, then send the sender a
   * copy.
   *
   * Nothing is stored: the support mailbox is the record. The ticket is a
   * reference for matching replies, not a database id. The forward has to
   * succeed — the form tells the visitor their message was received, so a
   * failed send is a 503, not a silent success. The copy to the sender is
   * best-effort.
   */
  async send(dto: SendContactMessageDto): Promise<ContactMessageReceipt> {
    const ticket = `BB-${randomInt(100000, 1000000)}`;
    const params: ContactMessageTemplateParams = {
      ticket,
      topicLabel: CONTACT_TOPIC_LABELS[dto.topic],
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone || undefined,
      referenceId: dto.referenceId || undefined,
      message: dto.message,
    };

    const delivered = await this.mailService.sendContactMessage(params);
    if (!delivered) {
      throw new ServiceUnavailableException(
        'We could not send your message right now. Please try again, or email support@bidsbazar.com.',
      );
    }

    await this.mailService.sendContactAcknowledgement(params);
    this.logger.log('Contact message forwarded', { ticket, topic: dto.topic });
    return { ticket };
  }
}
