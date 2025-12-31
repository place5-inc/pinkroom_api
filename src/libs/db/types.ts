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
    user_id: string | null;
    phone_number: string | null;
    template_code: string | null;
    created_at: Timestamp | null;
    json: string | null;
    result_code: string | null;
    exception_message: string | null;
};
export type payments = {
    id: Generated<number>;
    user_id: string | null;
    status: string | null;
    created_at: Timestamp | null;
    tid: string | null;
    oid: string | null;
    price: number | null;
};
export type photo_code_log = {
    id: Generated<number>;
    photo_id: number | null;
    code: string | null;
    used_user_id: string | null;
    created_at: Timestamp | null;
};
export type photo_results = {
    id: Generated<number>;
    original_photo_id: number | null;
    hair_design_id: number | null;
    result_image_id: string | null;
    created_at: Timestamp | null;
    status: string | null;
};
export type photo_share_code = {
    id: Generated<number>;
    photo_id: number | null;
    code: string | null;
    created_at: Timestamp | null;
    expired_at: Timestamp | null;
    code_type: string | null;
};
export type photos = {
    id: Generated<number>;
    user_id: string;
    upload_file_id: string;
    payment_id: number | null;
    created_at: Timestamp | null;
};
export type prompt = {
    design_id: number;
    ment: string | null;
    upload_file_id: string | null;
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
    name: string | null;
    use_code_id: string | null;
    use_code_photo_id: number | null;
    sample_type: string | null;
};
export type worldcup_votes = {
    id: Generated<number>;
    photo_id: number | null;
    result_id: number | null;
    name: string | null;
    user_id: string | null;
    created_at: Timestamp | null;
};
export type DB = {
    code_hair_design: code_hair_design;
    code_hair_style: code_hair_style;
    kakao_log: kakao_log;
    payments: payments;
    photo_code_log: photo_code_log;
    photo_results: photo_results;
    photo_share_code: photo_share_code;
    photos: photos;
    prompt: prompt;
    upload_file: upload_file;
    user_certification: user_certification;
    users: users;
    worldcup_votes: worldcup_votes;
};
