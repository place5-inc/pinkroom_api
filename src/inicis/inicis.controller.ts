import {
  All,
  BadRequestException,
  Body,
  Controller,
  MethodNotAllowedException,
  NotFoundException,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { InicisService } from './inicis.service';
import { PaymentService } from 'src/payment/payment.service';
type RefType = 'pc' | 'mo';
@Controller('inicis')
export class InicisController {
  constructor(
    private readonly inicisService: InicisService,
    private readonly paymentService: PaymentService,
  ) {}
  @All('confirm/:ref')
  async confirmPayment(
    @Req() { method }: Request,
    @Param('ref') ref: RefType,
    @Query() query,
    @Body() body,
  ) {
    if (ref !== 'pc' && ref !== 'mo') {
      throw new NotFoundException();
    }

    let paymentResult = undefined;
    switch (method) {
      case 'GET':
        paymentResult = query;
        break;
      case 'POST':
        paymentResult = body;
        break;
      default:
        throw new MethodNotAllowedException();
    }

    if (ref === 'pc') {
      if (!paymentResult.resultCode) {
        throw new BadRequestException('invalid referrence');
      }

      return await this.inicisService.confirmPcPayment(paymentResult);
    } else {
      if (!paymentResult.P_STATUS) {
        throw new BadRequestException('invalid referrence');
      }

      return await this.inicisService.confirmMobilePayment(paymentResult);
    }
  }
}
