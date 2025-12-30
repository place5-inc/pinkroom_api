import { HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';

@Injectable()
export class PaymentService {
  constructor(private readonly db: DatabaseProvider) {}

  async completePayment(
    userId: string,
    oId: string,
    tId: string,
    price: number,
  ) {
    const result = await this.db
      .insertInto('payments')
      .values({
        user_id: userId,
        oid: oId,
        tid: tId,
        price: price,
        created_at: new Date(),
      })
      .output(['inserted.id'])
      .executeTakeFirst();
    return {
      status: HttpStatus.OK,
      paymentId: result.id,
    };
  }
}
