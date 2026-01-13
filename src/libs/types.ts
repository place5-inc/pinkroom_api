import { HttpStatus } from '@nestjs/common';

export const DEV_CONFIG = {
  isKakaoProduction: process.env.IS_KAKAO_PRODUCTION === 'on',
  isProduction: process.env.NODE_ENV === 'production',
  devPhoneNumberList: [
    '01053095304',
    '01027175360',
    '01082559695',
    '01073002335',
    '01054697884',
    '01021632335',
    '01029056598',
  ],
};
export type PhotoStatus =
  | 'first_generating'
  | 'rest_generating'
  | 'complete'
  | 'finished';
export type PhotoResultStatus = 'pending' | 'complete' | 'fail';
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
  image?: Image;
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
  image?: Image;
  ai?: string;
};
export type AuthBody = {
  phone?: string;
  code?: string;
  sampleType?: number;
  token?: string;
};
export type UploadPhotoBody = {
  userId?: string;
  image?: Image;
  paymentId?: number;
  code?: string;
  designId?: number;
  photoId?: number;
};
export type WorldcupBody = {
  voteId?: number;
  photoId?: number;
  code?: string;
  resultId: number;
  userId?: string;
  name?: string;
};
export type UserVO = {
  id?: string;
  phone?: string;
  name?: string;
  sampleType?: number;
};

export type PhotoVO = {
  id: number;
  paymentId?: number;
  code?: string;
  sourceImageUrl: string;
  thumbnailBeforeAfterUrl?: string;
  thumbnailWorldcupUrl?: string;
  resultImages: ResultImageVO[];
  createdAt: string;
  selectedDesignId?: number;
  didShareWorldcup?: boolean;
  mergedImageUrl?: string;
  status?: string;
  retryCount?: number;
};

export type ResultImageVO = {
  id: number;
  url: string;
  designId: number;
  status: string;
  createdAt?: string;
  failCode?: string;
};

export function isValidImage(fileData: string) {
  const pattern =
    /^data:(image\/(png|jpeg|jpg|gif|webp));base64,([A-Za-z0-9+/=]+)$/;
  const isImage = pattern.test(fileData);

  return !!isImage;
}

export type KakaoJson = {
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
