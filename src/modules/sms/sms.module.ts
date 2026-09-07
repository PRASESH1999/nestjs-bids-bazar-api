import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SparrowSmsService } from './sparrow-sms.service';

@Module({
  imports: [HttpModule],
  providers: [SparrowSmsService],
  exports: [SparrowSmsService],
})
export class SmsModule {}
