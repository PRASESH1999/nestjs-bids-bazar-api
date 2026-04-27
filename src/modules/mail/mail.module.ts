import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Global mail module — registered once in AppModule.
 * Any other module can inject MailService without importing MailModule explicitly.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
