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
