import { Body, Controller, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreateLinkDto } from 'src/common/dto';
import { Auth, GetUser } from 'src/auth/decorators';
import { Types } from 'mongoose';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('generate-link')
  @Auth()
  generateLink(
    @Body() createLinkDto: CreateLinkDto,
    @GetUser('agencia') agencia: Types.ObjectId,
  ) {
    return this.paymentsService.generatePaymentLink(createLinkDto, agencia);
  }
}
