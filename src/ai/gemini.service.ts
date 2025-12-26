import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { HairDesignVO, HairStyleVO, Image, PromptVO } from 'src/libs/types';
import { isEmpty, isNull, getMimeTypeFromUri } from 'src/libs/helpers';
import { AzureBlobService } from 'src/azure/blob.service';
import { DateTime } from 'luxon';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GoogleGenAI } from '@google/genai';
import { PhotoService } from './../user/photo.service';
@Injectable()
export class GeminiService {
  constructor(
    //private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly httpService: HttpService,
    //private readonly photoService: PhotoService,
  ) {}
  async generatePhoto(fileUri: string, ment: string): Promise<string> {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new InternalServerErrorException('GEMINI_API_KEY is missing');
      }

      const mimeType = getMimeTypeFromUri(fileUri);
      const ai = new GoogleGenAI({ apiKey });

      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [
          {
            role: 'user',
            parts: [{ fileData: { mimeType, fileUri } }, { text: ment }],
          },
        ],
        config: {
          responseModalities: ['Text', 'Image'],
          imageConfig: {
            imageSize: process.env.GEMINI_IMAGE_SIZE ?? '2K',
          },
        },
      });

      const parts = geminiResponse.candidates?.[0]?.content?.parts;
      if (!parts) {
        throw new InternalServerErrorException('이미지 생성에 실패했습니다.');
      }

      const imagePart = parts.find((p: any) => p.inlineData);
      if (!imagePart?.inlineData) {
        const textPart = parts.find((p: any) => p.text);
        throw new InternalServerErrorException(
          textPart?.text || '이미지를 생성할 수 없습니다.',
        );
      }

      return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    } catch (e) {
      throw e;
    }
  }
}
