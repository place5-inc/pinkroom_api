import { HttpStatus } from '@nestjs/common';

export const DEV_CONFIG = {};

export type DTO<T = never> = Promise<DTOBody<T>>;
export type DTOBody<T = never> = {
  status: HttpStatus;
  message?: string;
  data?: T;
};

export type HairStyleVO = {
  id?: number;
  name?: string;
  orderSeq?: number;
  publishedAt?: Date | null;
  designs?: HairDesignVO[];
};
export type HairDesignVO = {
  id?: number;
  styleId?: number;
  name?: string;
  orderSeq?: number;
  publishedAt?: Date | null;
};
export type PromptVO = {
  designId?: number;
  ment?: string;
};
export type Image = {
  url?: string;
  data?: string;
  id?: string;
};
export type AdminBody = {
  id?: number;
  name?: string;
  ment?: string;
  styleId?: number;
  designId?: number;
  setOn?: boolean;
};
export type AuthBody = {
  phone?: string;
  code?: string;
};
export function isValidImage(fileData: string) {
  const pattern =
    /^data:(image\/(png|jpeg|jpg|gif|webp));base64,([A-Za-z0-9+/=]+)$/;
  const isImage = pattern.test(fileData);

  return !!isImage;
}
