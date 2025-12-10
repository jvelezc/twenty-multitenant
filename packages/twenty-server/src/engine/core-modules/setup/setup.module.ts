import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SetupController } from './setup.controller';

@Module({
  imports: [ConfigModule],
  controllers: [SetupController],
})
export class SetupModule {}
