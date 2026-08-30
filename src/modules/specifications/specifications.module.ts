import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Specification } from './entities/specification.entity';
import { SpecificationsService } from './specifications.service';
import { SpecificationsController } from './specifications.controller';
import { AdminSpecificationsController } from './admin-specifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Specification])],
  controllers: [SpecificationsController, AdminSpecificationsController],
  providers: [SpecificationsService],
  exports: [SpecificationsService],
})
export class SpecificationsModule {}
