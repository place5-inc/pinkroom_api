import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type business = {
    id: Generated<number>;
    type: string | null;
    area_id: number | null;
    name: string | null;
    name_ko: string | null;
    curation_price: string | null;
    curation_traffic: string | null;
    curation_service: string | null;
    rank: number | null;
    line_url: string | null;
    access_info: string | null;
    status: string | null;
    x: number | null;
    y: number | null;
    updated_at: Timestamp | null;
};
export type business_detail = {
    id: number;
    tax_benefit: string | null;
    review_google_url: string | null;
    review_naver_url: string | null;
    address_korea: string | null;
    address_japan: string | null;
};
export type business_images = {
    id: Generated<number>;
    business_id: number | null;
    url: string | null;
    upload_file_id: string | null;
    order_seq: number | null;
};
export type business_member = {
    id: Generated<number>;
    business_id: number | null;
    upload_file_id: string | null;
    profile_url: string | null;
    name: string | null;
    grade: string | null;
    job: string | null;
};
export type business_price_category = {
    id: Generated<number>;
    business_id: number | null;
    parent_id: number | null;
    name: string | null;
    order_seq: number | null;
    category_id: number | null;
};
export type business_price_item = {
    id: Generated<number>;
    category_id: number | null;
    name: string | null;
    price: number | null;
    order_seq: number | null;
    min_price: number | null;
    max_price: number | null;
};
export type business_review = {
    id: Generated<number>;
    business_id: number | null;
    type: string | null;
    ment: string | null;
    created_at: Timestamp | null;
};
export type business_schedule_breaks = {
    id: Generated<number>;
    business_id: number | null;
    type: string | null;
    weekday: number | null;
    open_time: Timestamp | null;
    close_time: Timestamp | null;
    is_open: boolean | null;
};
export type business_schedule_exception_recurring = {
    id: Generated<number>;
    business_id: number | null;
    weekday: number | null;
    nth_week: number | null;
    open_time: Timestamp | null;
    close_time: Timestamp | null;
    is_open: boolean | null;
};
export type business_schedule_hours = {
    id: Generated<number>;
    business_id: number | null;
    weekday: number | null;
    open_time: Timestamp | null;
    close_time: Timestamp | null;
    booking_deadline: Timestamp | null;
    is_open: boolean | null;
};
export type business_schedule_ments = {
    id: Generated<number>;
    business_id: number | null;
    ment: string | null;
};
export type business_section = {
    id: Generated<number>;
    business_id: number | null;
    type: string | null;
    ment: string | null;
};
export type business_service_category = {
    id: Generated<number>;
    business_id: number;
    code_id: number;
};
export type business_service_item = {
    id: Generated<number>;
    business_id: number;
    category_id: number;
    code_id: number;
};
export type business_subway = {
    id: Generated<number>;
    business_id: number | null;
    subway_id: string | null;
};
export type code_business_area = {
    id: Generated<number>;
    name_ko: string | null;
    name: string | null;
};
export type code_business_service_category = {
    id: Generated<number>;
    name: string | null;
    name_ko: string | null;
    type: string | null;
    order_seq: number | null;
};
export type code_business_service_item = {
    id: Generated<number>;
    category_id: number | null;
    name: string | null;
    name_ko: string | null;
    description: string | null;
    url: string | null;
    upload_file_id: string | null;
};
export type upload_file = {
    id: string;
    file_name: string | null;
    url: string;
    created_at: Timestamp;
};
export type user_action_log = {
    id: Generated<number>;
    user_id: string | null;
    description: string | null;
    log_at: Timestamp | null;
};
export type user_tester_id = {
    id: Generated<number>;
    user_id: string | null;
};
export type DB = {
    business: business;
    business_detail: business_detail;
    business_images: business_images;
    business_member: business_member;
    business_price_category: business_price_category;
    business_price_item: business_price_item;
    business_review: business_review;
    business_schedule_breaks: business_schedule_breaks;
    business_schedule_exception_recurring: business_schedule_exception_recurring;
    business_schedule_hours: business_schedule_hours;
    business_schedule_ments: business_schedule_ments;
    business_section: business_section;
    business_service_category: business_service_category;
    business_service_item: business_service_item;
    business_subway: business_subway;
    code_business_area: code_business_area;
    code_business_service_category: code_business_service_category;
    code_business_service_item: code_business_service_item;
    upload_file: upload_file;
    user_action_log: user_action_log;
    user_tester_id: user_tester_id;
};
