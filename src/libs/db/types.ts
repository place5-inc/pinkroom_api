import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type code_hair_design = {
    id: Generated<number>;
    style_id: number;
    name: string;
    published_at: Timestamp | null;
    order_seq: number | null;
};
export type code_hair_style = {
    id: Generated<number>;
    name: string;
    published_at: Timestamp | null;
    order_seq: number | null;
};
export type kakao_log = {
    key: Generated<number>;
    user_id: number | null;
    phone_number: string | null;
    template_code: string | null;
    created_at: Timestamp | null;
    json: string | null;
    result_code: string | null;
    exception_message: string | null;
};
export type prompt = {
    design_id: number;
    ment: string | null;
};
export type upload_file = {
    id: string;
    file_name: string | null;
    url: string | null;
    created_at: Timestamp | null;
};
export type user_certification = {
    id: Generated<number>;
    phone_number: string;
    code: string;
    required_at: Timestamp;
    expire_time: Timestamp;
};
export type users = {
    id: string;
    phone: string;
    created_at: Timestamp;
};
export type DB = {
    code_hair_design: code_hair_design;
    code_hair_style: code_hair_style;
    kakao_log: kakao_log;
    prompt: prompt;
    upload_file: upload_file;
    user_certification: user_certification;
    users: users;
};
