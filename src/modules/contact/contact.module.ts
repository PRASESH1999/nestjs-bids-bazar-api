import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

/** The public Contact Us form. MailService comes from the global MailModule. */
@Module({
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
