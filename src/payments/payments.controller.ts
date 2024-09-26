import { Body, Controller, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreateLinkDto } from 'src/common/dto';
import { Auth, GetUser } from 'src/auth/decorators';
import { User } from 'src/auth/entities/user.entity';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('generate-link')
  @Auth()
  generateLink(@Body() createLinkDto: CreateLinkDto, @GetUser() user: User) {
    return this.paymentsService.generatePaymentLink(createLinkDto, user);
  }
}
