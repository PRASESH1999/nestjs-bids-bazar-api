import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FonepaySignatureService } from './services/fonepay-signature.service';
import { FonepayAuthService } from './services/fonepay-auth.service';
import { FonepayClientService } from './services/fonepay-client.service';

@Module({
  imports: [HttpModule],
  providers: [
    FonepaySignatureService,
    FonepayAuthService,
    FonepayClientService,
  ],
  exports: [FonepayClientService],
})
export class FonepayModule {}
