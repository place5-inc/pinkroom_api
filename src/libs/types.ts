import { HttpStatus } from '@nestjs/common';

export const DEV_CONFIG = {};

export type DTO<T = never> = Promise<DTOBody<T>>;
export type DTOBody<T = never> = {
  status: HttpStatus;
  message?: string;
  data?: T;
};

export type AdminCommonCodeType = 'subway' | 'area';
export function isValidAdminCommonCodeType(
  type: string,
): type is AdminCommonCodeType {
  return (
    type === 'subway' ||
    type === 'area' ||
    type === 'serviceCategory' ||
    type === 'serviceItem'
  );
}

export type BusinessSectionType = 'jp_service' | 'directions';
export function isValidBusinessSectionType(
  type: string,
): type is BusinessSectionType {
  return type === 'jp_service' || type === 'directions';
}

export type BusinessReviewType = 'google' | 'naver';
export function isValidBusinessReviewType(
  type: string,
): type is BusinessReviewType {
  return type === 'google' || type === 'naver';
}

export type BusinessStatusType = 'waiting' | 'publish' | null;

export type BusinessType = 'clinic' | 'pharmacy' | 'beauty';

export type Subway =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'air' //공항철도
  | 'kja' //경의중앙선
  | 'sbd' //수인분당선
  | 'nbd'; //신분당선

export function isValidSubway(subway: string): subway is Subway {
  return [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    'air',
    'kja',
    'sbd',
    'nbd',
  ].includes(subway);
}

export type Image = {
  url?: string;
  data?: string;
  id?: string;
};
export function isValidImage(fileData: string) {
  const pattern =
    /^data:(image\/(png|jpeg|jpg|gif|webp));base64,([A-Za-z0-9+/=]+)$/;
  const isImage = pattern.test(fileData);

  return !!isImage;
}

//서울뷰티컨시어지
export type BusinessVO = {
  id?: number | null;
  type?: BusinessType | null;
  images?: Image[] | null;
  name?: string | null;
  nameKo?: string | null;
  subway?: string[] | null;
  accessInfo?: string | null;
  curationPrice?: string | null;
  curationTraffic?: string | null;
  curationService?: string | null;
  lineUrl?: string | null;
  x?: number | null;
  y?: number | null;
  serviceCategory?: BusinessServiceCategoryVO[] | null;
  serviceItemIds?: number[] | null; //어드민 인풋용
  status?: BusinessStatusType | null;
  detail?: BusinessDetailVO;
  rank?: number | null;
  area?: CodeBusinessAreaVO | null;
  areaId?: number | null;
  marker?: number | null;
};

export type BusinessDetailVO = {
  id?: number;
  taxBenefit?: string;
  addressKorea?: string;
  addressJapan?: string;
  sections?: BusinessSectionVO[] | null;
  members?: BusinessMemberVO[] | null;
  reviews?: BusinessReviewVO[] | null;
  schedule?: BusinessScheduleVO | null;
  price?: BusinessPriceVO[] | null;
};

export type BusinessServiceCategoryVO = {
  id?: number | null;
  name?: string | null;
  nameKo?: string | null;
  items?: BusinessServiceItemVO[] | null;
};

export type BusinessServiceItemVO = {
  id?: number | null;
  name?: string | null;
  nameKo?: string | null;
  description?: string | null;
  image?: Image | null;
};

export type BusinessSectionVO = {
  type?: string | null;
  ments?: string[] | null;
};

export type BusinessMemberVO = {
  profileImage?: Image | null;
  name?: string | null;
  grade?: string | null;
  job?: string | null;
};

export type BusinessReviewVO = {
  type?: string | null;
  list?: BusinessReviewItemVO[] | null;
  linkUrl?: string | null;
};

export type BusinessReviewItemVO = {
  ment?: string | null;
  createdAt?: string | null;
};

export type BusinessScheduleVO = {
  scheduleHours?: BusinessScheduleHoursVO[] | null;
  scheduleMent?: string[] | null;
  scheduleException?: BusinessScheduleExceptionRecurringVO[] | null;
  scheduleBreaks?: BusinessScheduleBreaksVO[] | null;
};

export type BusinessScheduleHoursVO = {
  id?: number;
  weekday?: number;
  isOpen?: boolean;
  openTime?: string;
  closeTime?: string;
  bookingDeadline?: string;
};

export type BusinessScheduleExceptionRecurringVO = {
  id?: number;
  //type?: string;
  weekday?: number;
  nthWeek?: number;
  isOpen?: boolean;
  openTime?: string;
  closeTime?: string;
};

export type BusinessScheduleBreaksVO = {
  id?: number | null;
  //type?: string | null;
  weekday?: number;
  isOpen?: boolean | null;
  openTime?: string | null;
  closeTime?: string | null;
};

export type CodeBusinessAreaVO = {
  id?: number | null;
  nameKo?: string | null;
  name?: string | null;
};

export type BusinessPriceVO = {
  id?: number | null;
  name?: string | null;
  price?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  list?: BusinessPriceVO[] | null;
  categoryId?: number | null;
};

export type BusinessScheduleExceptionDate = {
  id?: number;
  date?: string;
  isClosed?: boolean;
  openTime?: string;
  closeTime?: string;
};
export type CodeBody = {
  type?: string;
  parentId?: number;
  id?: number;
  name?: string;
  nameKo?: string;
  description?: string;
  image?: Image;
  businessType?: string;
};
