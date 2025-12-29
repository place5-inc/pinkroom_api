import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { getMimeTypeFromUri } from 'src/libs/helpers';
import { AzureBlobService } from 'src/azure/blob.service';
import { HttpService } from '@nestjs/axios';
import { GoogleGenAI } from '@google/genai';
@Injectable()
export class GeminiService {
  constructor(
    //private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly httpService: HttpService,
    //private readonly photoService: PhotoService,
  ) {}
  async generatePhoto(
    fileUri: string,
    ment: string,
    sampleUrl?: string,
  ): Promise<string> {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new InternalServerErrorException('GEMINI_API_KEY is missing');
      }

      const ai = new GoogleGenAI({ apiKey });
      const userMimeType = getMimeTypeFromUri(fileUri);

      // parts를 동적으로 구성
      const parts: any[] = [
        // 1️⃣ 사용자 얼굴 이미지
        {
          fileData: {
            mimeType: userMimeType,
            fileUri,
          },
        },
      ];

      // 2️⃣ sampleUrl이 있으면 참고 이미지 추가
      if (sampleUrl) {
        parts.push({
          fileData: {
            mimeType: getMimeTypeFromUri(sampleUrl),
            fileUri: sampleUrl,
          },
        });
      }

      // 3️⃣ 프롬프트 구성
      const prompt = sampleUrl
        ? `
  첫 번째 이미지는 사용자의 얼굴 사진입니다.
  두 번째 이미지는 참고할 헤어스타일 예시입니다.
  ${ment}
  - 두 번째 이미지는 헤어스타일 참고용으로만 사용하세요.
  `
        : ment;

      parts.push({ text: prompt });

      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        config: {
          responseModalities: ['Text', 'Image'],
          imageConfig: {
            imageSize: process.env.GEMINI_IMAGE_SIZE ?? '2K',
          },
        },
      });

      const resultParts = geminiResponse.candidates?.[0]?.content?.parts;
      if (!resultParts) {
        throw new InternalServerErrorException('이미지 생성에 실패했습니다.');
      }

      const imagePart = resultParts.find((p: any) => p.inlineData);
      if (!imagePart?.inlineData) {
        const textPart = resultParts.find((p: any) => p.text);
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
