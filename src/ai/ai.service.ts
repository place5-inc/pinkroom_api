import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { getMimeTypeFromUri } from 'src/libs/helpers';
import { AzureBlobService } from 'src/azure/blob.service';
import { HttpService } from '@nestjs/axios';
import { GoogleGenAI } from '@google/genai';
@Injectable()
export class AiService {
  constructor(
    //private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly httpService: HttpService,
    //private readonly photoService: PhotoService,
  ) {}
  async check() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const models = await ai.models.list({ config: { pageSize: 200 } });
    for await (const m of models) {
      console.log(m.name);
    }
  }
  async generatePhotoGemini(
    fileUri?: string,
    fileBase64?: string,
    ment?: string,
    sampleUrl?: string,
    key?: string,
  ): Promise<string> {
    try {
      const apiKey = key ?? process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new InternalServerErrorException('GEMINI_API_KEY is missing');
      }
      if (!fileUri && !fileBase64) {
        throw new BadRequestException(
          'fileUri 또는 fileBase64 중 하나는 필수입니다.',
        );
      }

      const model = process.env.GEMINI_MODEL_ID;
      const ai = new GoogleGenAI({ apiKey });

      // parts를 동적으로 구성
      const parts: any[] = [];
      // 1) 사용자 얼굴 이미지: fileUri 우선, 없으면 base64
      if (fileUri) {
        const userMimeType = getMimeTypeFromUri(fileUri);
        parts.push({
          fileData: {
            mimeType: userMimeType,
            fileUri,
          },
        });
      } else if (fileBase64) {
        // Base64 파싱 (data URL 형태 기대)
        const base64Match = fileBase64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!base64Match) {
          throw new BadRequestException('올바른 이미지 형식이 아닙니다.');
        }

        const mimeType = base64Match[1]; // ex) image/png
        const base64Data = base64Match[2];

        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      }

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
        // model: 'gemini-2.5-flash-image',
        model: model,
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
          httpOptions: { timeout: 60_000 },
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

  async generatePhotoSeedream(
    fileUri?: string,
    fileBase64?: string,
    ment?: string,
    sampleUrl?: string,
  ): Promise<string> {
    const apiKey = process.env.AIML_API_KEY;
    if (!apiKey)
      throw new InternalServerErrorException('AIML_API_KEY is missing');

    const baseUrl =
      process.env.ARK_BASE_URL ??
      'https://ark.ap-southeast.bytepluses.com/api/v3'; // 튜토리얼 기본값 :contentReference[oaicite:7]{index=7}

    // ✅ 입력 이미지(얼굴)
    const image = normalizeImageInput(fileUri, fileBase64);

    // ✅ 프롬프트
    const prompt = buildPrompt(ment, sampleUrl);

    // 얼굴 사진을 “편집(i2i)”하는 흐름이면 SeedEdit가 맞음 (튜토리얼도 images.generate + image 사용) :contentReference[oaicite:8]{index=8}
    const model = process.env.SEEDEDIT_MODEL_ID ?? 'seedream-4-0-250828'; // 튜토리얼 예시 :contentReference[oaicite:9]{index=9}

    const res = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        image, // ✅ SeedEdit i2i 핵심 파라미터 :contentReference[oaicite:10]{index=10}
        response_format: 'b64_json',
        // size: 'adaptive',   // 필요하면 사용(SeedEdit 예시에서 size="adaptive") :contentReference[oaicite:11]{index=11}
        // seed: 123,
        // guidance_scale: 5.5,
        // watermark: true,
      }),
    });

    const data = await parseArkJson(res);

    const first = data?.data?.[0];
    if (!first)
      throw new InternalServerErrorException('응답 data[0]가 없습니다.');

    if (first.b64_json) {
      return `data:image/png;base64,${first.b64_json}`;
    }
    if (first.url) {
      return first.url as string;
    }

    throw new InternalServerErrorException('결과에 url/b64_json이 없습니다.');
  }
}

function normalizeImageInput(fileUri?: string, fileBase64?: string): string {
  // SeedEdit 예시에서 image는 URL로 들어가므로 URL이면 그대로 사용 :contentReference[oaicite:5]{index=5}
  if (fileUri) return fileUri;

  if (!fileBase64) {
    throw new BadRequestException(
      'fileUri 또는 fileBase64 중 하나는 필수입니다.',
    );
  }

  const trimmed = fileBase64.trim();

  // data URL이면 그대로
  if (trimmed.startsWith('data:image/')) return trimmed;

  // "순수 base64"만 들어오는 경우면 mime이 없으니 png로 가정 (원하면 여기 로직 강화 가능)
  return `data:image/png;base64,${trimmed}`;
}

function buildPrompt(ment?: string, sampleUrl?: string): string {
  const base = (ment ?? '').trim();

  if (!sampleUrl) {
    if (!base) throw new BadRequestException('ment(prompt)가 비어있습니다.');
    return base;
  }

  // ⚠️ SeedEdit(i2i)는 튜토리얼 예시상 image 입력은 1개 파라미터로 보입니다. :contentReference[oaicite:6]{index=6}
  // sampleUrl(헤어 참고 이미지)을 "추가 이미지"로 넣는 공식 파라미터는 여기 코드에선 사용하지 않습니다.
  // 대신 프롬프트에 참고 설명을 넣는 방식(또는 샘플을 텍스트로 묘사해서 넣기)을 추천.
  const prompt = `
첫 번째 이미지는 사용자의 얼굴 사진입니다.
두 번째 이미지는 참고할 헤어스타일 예시(텍스트 참고용)입니다: ${sampleUrl}
${base}
- 위 URL은 참고용 설명이며, 가능한 경우 헤어스타일 특징을 텍스트로 구체적으로 반영하세요.
`.trim();

  return prompt;
}

async function parseArkJson(res: Response) {
  const contentType = res.headers.get('content-type') ?? '';
  const raw = await res.text();

  if (!res.ok) {
    throw new InternalServerErrorException(
      `Seedream/SeedEdit API error: ${res.status} ${raw.slice(0, 800)}`,
    );
  }

  // ✅ HTML이 오면 여기서 바로 잡힘 (Unexpected token '<' 방지)
  if (!contentType.includes('application/json')) {
    throw new InternalServerErrorException(
      `Expected JSON but got "${contentType}". body=${raw.slice(0, 800)}`,
    );
  }

  return JSON.parse(raw);
}
