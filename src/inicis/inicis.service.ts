import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { DatabaseProvider } from 'src/libs/db';
import * as crypto from 'crypto';
import axios from 'axios';
import { PaymentService } from 'src/payment/payment.service';

@Injectable()
export class InicisService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly paymentService: PaymentService,
  ) {}

  private readonly mid = 'kimstudy00'; //process.env.INICIS_MID || 'kimstudy00'; // || 'INIpayTest';

  private readonly signKey = 'VGxsaVdEMlNNa0lqbDc2QUVNdGxhZz09';
  //process.env.INICIS_SIGN_KEY || 'VGxsaVdEMlNNa0lqbDc2QUVNdGxhZz09'; // || 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS';
  private axiosClient = axios.create({
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  async confirmPcPayment({
    resultCode,
    resultMsg,
    orderNumber,
    mid,
    authToken,
    authUrl,
    netCancelUrl,
    charset,
  }: {
    resultCode: string;
    resultMsg: string;
    orderNumber: string;
    mid: string;
    authToken: string;
    authUrl: string;
    netCancelUrl: string;
    charset: string;
  }) {
    if (this.mid !== mid) {
      throw new UnauthorizedException('invalid inicis mid');
    }
    if (resultCode === '0000') {
      const now = DateTime.now();
      const timestamp = now.toMillis();

      // SHA256 Hash값 [대상: authToken, timestamp]
      const signature = crypto
        .createHash('sha256')
        .update(`authToken=${authToken}&timestamp=${timestamp}`)
        .digest('hex');
      // SHA256 Hash값 [대상: authToken, signKey, timestamp]
      const verification = crypto
        .createHash('sha256')
        .update(
          `authToken=${authToken}&signKey=${this.signKey}&timestamp=${timestamp}`,
        )
        .digest('hex');

      let options = {
        mid,
        authToken,
        timestamp,
        signature,
        verification,
        charset,
        format: 'JSON',
      };
      try {
        const confirmResponse = await this.axiosClient.post(authUrl, options);
        if (
          confirmResponse.status === 200 &&
          confirmResponse.data.resultCode === '0000'
        ) {
          const data = confirmResponse.data;
          return await this.paymentService.completePayment(data.MOID, data.tid);
        }
      } catch (err) {}
    }
  }
}
