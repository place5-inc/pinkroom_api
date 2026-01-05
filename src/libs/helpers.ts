import { DateTime } from 'luxon';
import { DatabaseProvider } from './db';
import { HairStyleVO } from './types';
import { DB } from './db/types';
import { AllSelection } from 'kysely/dist/cjs/parser/select-parser';

export function isNull(value: any) {
  if (value === undefined) {
    return true;
  }

  if (value === null) {
    return true;
  }
}

export function isEmpty(value: any) {
  if (isNull(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (value instanceof Object) {
    return Object.keys(value).length === 0;
  }

  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  if (typeof value === 'number') {
    return value === -9999;
  }

  return false;
}

export function parseNumberArray(val?: string[] | string): number[] {
  if (!val) return [];

  const arr = Array.isArray(val) ? val : [val];

  return arr.map((v) => Number(v)).filter((v) => !Number.isNaN(v));
}

import * as crypto from 'crypto';
import { HttpException } from '@nestjs/common';

export function encrypt(
  text: string,
  {
    algorithm = 'aes-256-cbc',
    encoding = 'utf8',
    secret = process.env.BACKDOOR_SECRET_KEY ?? 'marrykim-backdoor-!@#',
  }: {
    algorithm?: string;
    encoding?: crypto.Encoding;
    secret?: string;
  } = {},
) {
  const secretKey = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, encoding),
    cipher.final(),
  ]);
  return [iv.toString('hex'), encrypted.toString('hex')];
}
export function getMimeTypeFromUri(uri: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      throw new Error(`Unsupported image extension: ${ext}`);
  }
}
export function generateCode(length: number = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // 대문자 + 숫자
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function normalizeError(e: unknown) {
  // Nest HttpException
  if (e instanceof HttpException) {
    const res = e.getResponse(); // string | object
    return {
      name: e.name,
      message:
        typeof res === 'string' ? res : ((res as any).message ?? e.message),
      status: e.getStatus(),
      response: typeof res === 'string' ? null : res,
      stack: e.stack ?? null,
    };
  }

  // 일반 Error
  if (e instanceof Error) {
    return {
      name: e.name,
      message: e.message,
      status: null,
      response: null,
      stack: e.stack ?? null,
    };
  }

  // 그 외(문자열/객체)
  return {
    name: 'UnknownError',
    message: typeof e === 'string' ? e : JSON.stringify(e),
    status: null,
    response: null,
    stack: null,
  };
}

const _prefix_ = [
  '다정한',
  '따뜻한',
  '상냥한',
  '밝은',
  '해맑은',
  '유쾌한',
  '친절한',
  '순둥한',
  '부드러운',
  '착한',
  '믿음직한',
  '성실한',
  '배려깊은',
  '온화한',
  '부지런한',
  '신중한',
  '말랑한',
  '엉뚱한',
  '귀여운',
  '웃음많은',
  '달콤한',
  '수줍은',
  '활기찬',
  '설레는',
  '두근거리는',
  '감동받은',
  '꿈꾸는',
  '은은한',
  '평온한',
  '향기로운',
  '사랑스러운',
  '진지한',
  '정겨운',
  '행복한',
  '똑부러진',
  '정직한',
  '차분한',
  '해맑은',
  '용기있는',
  '센스있는',
  '성격좋은',
  '똘망똘망한',
  '날고싶은',
  '콩닥콩닥',
  '꽃을든',
  '깜짝놀란',
  '집중하는',
  '반짝이는',
  '매력적인',
  '기분좋은',
  '공부하는',
  '쇼핑하는',
  '여행중인',
  '책읽는',
  '인기많은',
  '계획적인',
  '헤엄치는',
  '노래하는',
];

const _name_ = [
  '이상해씨',
  '이상해풀',
  '이상해꽃',
  '파이리',
  '리자드',
  '리자몽',
  '꼬부기',
  '어니부기',
  '거북왕',
  '캐터피',
  '버터플',
  '피카츄',
  '라이츄',
  '푸린',
  '푸크린',
  '고라파덕',
  '골덕',
  '이브이',
  '샤미드',
  '부스터',
  '쥬피썬더',
  '라프라스',
  '메타몽',
  '잠만보',
  '프리져',
  '썬더',
  '파이어',
];

export function getRandomName() {
  const prefix = _prefix_[Math.floor(Math.random() * _prefix_.length)];
  const name = _name_[Math.floor(Math.random() * _name_.length)];

  return `${prefix}${name}`;
}
