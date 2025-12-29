import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
    userId,
    resultCode,
    resultMsg,
    orderNumber,
    mid,
    authToken,
    authUrl,
    netCancelUrl,
    charset,
  }: {
    userId: string;
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
          return await this.paymentService.completePayment(
            userId,
            data.MOID,
            data.tid,
            data.TotPrice,
          );
        }
      } catch (err) {}
    }
  }
  async confirmMobilePayment({
    userId,
    P_STATUS,
    P_RMESG1,
    P_TID,
    P_AMT,
    idc_name,
    P_REQ_URL,
    P_NOTI,
  }: {
    userId: string;
    P_STATUS: string;
    P_RMESG1: string;
    P_TID: string;
    P_AMT: string;
    idc_name: 'fc' | 'ks' | 'stg';
    P_REQ_URL: string;
    P_NOTI: string;
  }) {
    const P_MID = P_TID.substring(10, 20);
    if (P_STATUS === '00') {
      const _P_NET_CANCEL_URL = `https://${idc_name}mobile.inicis.com/smart/payNetCancel.ini`;

      try {
        const confirmResponse = await this.axiosClient.post(P_REQ_URL, {
          P_MID,
          P_TID,
        });

        if (confirmResponse.status === 200) {
          const data = confirmResponse.data.split('&').reduce(
            (cur, arr) => {
              const [key, value] = arr.split('=');
              cur[key] = value;
              return cur;
            },
            {} as Record<string, string>,
          );

          if (data.P_STATUS === '00') {
            return await this.paymentService.completePayment(
              userId,
              data.P_OID,
              data.P_TID,
              data.P_AMT,
            );
          } else {
            throw new Error();
          }
        } else {
          throw new Error();
        }
      } catch {}
    } else {
      throw new BadRequestException(P_RMESG1);
    }
  }
}
