import { HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';

@Injectable()
export class PaymentService {
  constructor(private readonly db: DatabaseProvider) {}

  async completePayment(oId: string, tId: string) {
    await this.db
      .insertInto('payments')
      .values({
        oid: oId,
        tid: tId,
        created_at: new Date(),
      })
      .execute();
    return {
      status: HttpStatus.OK,
    };
  }
}
