import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './services/encryption.service';
import { StorageService } from './services/storage.service';

@Global()
@Module({
  providers: [EncryptionService, StorageService],
  exports: [EncryptionService, StorageService],
})
export class CommonModule {}
