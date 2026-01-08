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
  '거대한',
  '거침없는',
  '게으른',
  '고독한',
  '과묵한',
  '귀여운',
  '길쭉한',
  '까칠한',
  '깜찍한',
  '낙천적인',
  '날렵한',
  '냉정한',
  '넉살좋은',
  '노래하는',
  '느긋한',
  '늠름한',
  '다정한',
  '당당한',
  '도도한',
  '독특한',
  '듬직한',
  '따뜻한',
  '똑똑한',
  '말랑한',
  '명랑한',
  '무뚝뚝한',
  '민첩한',
  '바쁜',
  '발랄한',
  '배고픈',
  '변덕스러운',
  '부끄러운',
  '부드러운',
  '사랑스러운',
  '상냥한',
  '섬세한',
  '센스있는',
  '소심한',
  '솔직한',
  '수줍은',
  '순수한',
  '신비로운',
  '신중한',
  '심심한',
  '씩씩한',
  '앙증맞은',
  '어린',
  '엉뚱한',
  '여유로운',
  '열정적인',
  '영리한',
  '예쁜',
  '온화한',
  '용감한',
  '우아한',
  '웃고있는',
  '유쾌한',
  '자유로운',
  '작은',
  '잠자는',
  '재빠른',
  '재치있는',
  '조용한',
  '졸린',
  '즐거운',
  '지루한',
  '차분한',
  '천진난만한',
  '춤추는',
  '친절한',
  '커다란',
  '포근한',
  '피곤한',
  '해맑은',
  '행복한',
  '현명한',
  '호기심 많은',
  '활기찬',
  '힘쎈',
];

const _name_ = [
  '가젤',
  '갈매기',
  '강아지',
  '개구리',
  '개복치',
  '거북이',
  '고라니',
  '고래',
  '고릴라',
  '고슴도치',
  '고양이',
  '곰돌이',
  '공작',
  '금붕어',
  '기니피그',
  '기린',
  '까마귀',
  '까치',
  '꿀벌',
  '나무늘보',
  '나비',
  '낙타',
  '너구리',
  '늑대',
  '다람쥐',
  '달팽이',
  '당나귀',
  '도마뱀',
  '독수리',
  '돌고래',
  '두꺼비',
  '두더지',
  '두루미',
  '라마',
  '라쿤',
  '레서판다',
  '멧돼지',
  '물개',
  '미어캣',
  '반딧불이',
  '백조',
  '뱁새',
  '범고래',
  '벨루가',
  '병아리',
  '부엉이',
  '북극곰',
  '비둘기',
  '비버',
  '뻐꾸기',
  '사막여우',
  '사슴',
  '사자',
  '상어',
  '수달',
  '스컹크',
  '알파카',
  '앵무새',
  '얼룩말',
  '여우',
  '염소',
  '오랑우탄',
  '오리',
  '오소리',
  '올빼미',
  '원숭이',
  '족제비',
  '참새',
  '치타',
  '친칠라',
  '침팬지',
  '코뿔소',
  '코알라',
  '쿼카',
  '타조',
  '토끼',
  '판다',
  '페럿',
  '펠리컨',
  '펭귄',
  '표범',
  '플라밍고',
  '하마',
  '하이에나',
  '햄스터',
  '호랑이',
];

export function getRandomName() {
  const prefix = _prefix_[Math.floor(Math.random() * _prefix_.length)];
  const name = _name_[Math.floor(Math.random() * _name_.length)];

  return `${prefix}${name}`;
}
