import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRepository } from './user.repository';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { User } from '../user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRepository]),
  ],
  providers: [StripeService],
  controllers: [StripeController],
})
export class StripeModule {}

