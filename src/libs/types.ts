import { HttpStatus } from '@nestjs/common';

export const DEV_CONFIG = {
  isKakaoProduction: false,
  devPhoneNumberList: [],
};

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
export type UploadPhotoVo = {
  userId?: string;
  image?: Image;
  paymentId?: number;
  code?: string;
  designId?: number;
  originalPhotoId?: number;
};
export function isValidImage(fileData: string) {
  const pattern =
    /^data:(image\/(png|jpeg|jpg|gif|webp));base64,([A-Za-z0-9+/=]+)$/;
  const isImage = pattern.test(fileData);

  return !!isImage;
}

export type KakaoJson = {
  i?: string | null; // userId 암호화 진행한 후 iv 값
  k?: string | null; // userId 암호화 결과값
  templeteCode?: string | null;
  account: string;
  refkey: string;
  type: string;
  from: string;
  to: string;
  content: KakaoContentJson;
};

export type KakaoContentJson = {
  at?: KakaoContentBaseJson | null;
  ai?: KakaoContentBaseJson | null;
  ft?: KakaoContentBaseJson | null;
};

export type KakaoContentBaseJson = {
  senderkey: string;
  templatecode: string;
  message: string;
  button?: KakaoContentButtonJson[];
  header?: string | null;
  item?: KakaoContentItemJson | null;
  itemhighlight?: KakaoContentItemHighlightJson | null;
  image?: KakaoContentImageJson | null;
};

export type KakaoContentItemHighlightJson = {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
};

export type KakaoContentImageJson = {
  img_url?: string | null;
  img_link?: string | null;
};

export type KakaoContentButtonJson = {
  name: string;
  type: string;
  url_pc?: string | null;
  url_mobile?: string | null;
  scheme_ios?: string | null;
  scheme_android?: string | null;
};

export type KakaoContentItemJson = {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
};

export type SendKaKaoNewGetTokenModel = {
  accesstoken: string;
  type: string;
  expired: string;
};
