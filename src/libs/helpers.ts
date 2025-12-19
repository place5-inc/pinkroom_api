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
