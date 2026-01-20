import { HttpStatus, Injectable } from '@nestjs/common';

import axios from 'axios';
import * as FormData from 'form-data';

@Injectable()
export class MessageService {
  constructor() {}
  async requestVerifyCode(phone: string, code: string) {
    try {
      const ment = `핑크룸 인증번호 : ${code}`;

      await this.sendSMSCertiCode(phone, ment);
      return {
        status: HttpStatus.OK,
        message: '',
      };
    } catch (e) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: e.message,
      };
    }
  }
  async sendSMSCertiCode(phone: string, ment: string) {
    try {
      await this.sendMMS(phone, ment, '핑크룸 인증번호', 'SMS');
    } catch (e) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: e.message,
      };
    }
  }
  async sendErrorToManager(ment: string) {
    this.sendMMS('01054697884', ment, '핑크룸 에러', 'MMS');
    this.sendMMS('01073002335', ment, '핑크룸 에러', 'MMS');
  }
  async sendRetryError(ment: string) {
    this.sendMMS('01054697884', ment, 'retry 한도', 'MMS');
    this.sendMMS('01073002335', ment, 'retry 한도', 'MMS');
  }
  async sendMMS(
    phone: string,
    ment: string,
    title?: string,
    msg_type?: string, //SMS or MMS
  ) {
    let isSend = false;
    isSend = true;
    if (isSend) {
      const formData = new FormData();
      formData.append('user_id', 'place5');
      formData.append('key', 'irwt5sc5q8k7715yfbreen2nu8jthj9a');
      formData.append('msg', ment);
      formData.append('receiver', phone);
      formData.append('sender', '01080542338');
      formData.append('rdate', '');
      formData.append('rtime', '');
      formData.append('testmode_yn', '');
      formData.append('title', msg_type === 'SMS' ? 'title' : title);
      if (msg_type) {
        formData.append('msg_type', msg_type);
      }

      //
      formData.append('encoding', 'UTF-8');
      formData.append('charset', 'UTF-8');

      const mmsResponse = await axios.post(
        'https://apis.aligo.in/send/',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Content-Type': 'multipart/form-data; charset=UTF-8',
            'Accept-Charset': 'UTF-8',
            Accept: '*/*',
          },
          timeout: 15000,
        },
      );

      //console.log(mmsResponse.data);
      return mmsResponse.data;
    } else {
      return {
        status: HttpStatus.OK,
        message: '',
      };
    }
  }
}
