import { HttpStatus, Injectable } from '@nestjs/common';

import axios from 'axios';
import * as FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

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
      await this.sendMMS(phone, ment, '핑크룸 인증번호', 'SMS', null);
    } catch (e) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: e.message,
      };
    }
  }
  async sendMMS(
    phone: string,
    ment: string,
    title?: string,
    msg_type?: string, //SMS or MMS
    imageUrl?: string,
  ) {
    let tempFilePath;
    try {
      let _imageUrl;
      let isSend = false;
      isSend = true;
      if (isSend) {
        if (msg_type === 'SMS') {
        } else if (msg_type === 'MMS' || imageUrl) {
          _imageUrl =
            'https://kimstudy.blob.core.windows.net/lesson/9ababe62-3b70-4346-890b-772ce2159464.png';

          if (imageUrl) {
            msg_type = 'MMS';
            _imageUrl = imageUrl;
          }

          // 이미지 URL에서 파일 다운로드
          const response = await axios.get(_imageUrl, {
            responseType: 'arraybuffer',
          });

          // 임시 파일로 저장 (UUID를 사용하여 고유한 파일명 생성)
          const uniqueFileName = `temp_image_${uuidv4()}.png`;
          tempFilePath = path.join(os.tmpdir(), uniqueFileName);
          fs.writeFileSync(tempFilePath, response.data);
        }

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
        if (msg_type || imageUrl) {
          formData.append('msg_type', msg_type);
        }
        if (msg_type === 'MMS' || imageUrl) {
          formData.append('image', fs.createReadStream(tempFilePath));
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

        // 임시 파일 삭제
        if (msg_type === 'MMS' || imageUrl) {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        }

        //console.log(mmsResponse.data);
        return mmsResponse.data;
      } else {
        return {
          status: HttpStatus.OK,
          message: '',
        };
      }
    } catch (error) {
      // 에러 발생 시에도 임시 파일 삭제
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (unlinkError) {
          console.error('임시 파일 삭제 실패:', unlinkError.message);
        }
      }
      console.error(error.message);
      throw error;
    }
  }
}
