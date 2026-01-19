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
export type gemini_key = {
    id: Generated<number>;
    key: string | null;
    expired_at: Timestamp | null;
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
export type log_dev = {
    id: Generated<number>;
    user_id: string | null;
    photo_id: number | null;
    design_id: number | null;
    code: string | null;
    payment_id: number | null;
    api: string | null;
    created_at: Timestamp | null;
};
export type log_gemini_error = {
    id: Generated<number>;
    created_at: Timestamp | null;
    photo_id: number | null;
    design_id: number | null;
    error: string | null;
};
export type log_prompt = {
    id: Generated<number>;
    photo_id: number | null;
    design_id: number | null;
    prompt: string | null;
    created_at: Timestamp | null;
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
    try_count: number | null;
    fail_code: string | null;
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
    code: string | null;
    created_at: Timestamp | null;
    selected_design_id: number | null;
    thumbnail_before_after_id: string | null;
    thumbnail_worldcup_id: string | null;
    merged_image_id: string | null;
    status: string | null;
    retry_count: number | null;
    did_show_complete_popup: Generated<boolean | null>;
    updated_at: Timestamp | null;
    did_show_free_complete_popup: boolean | null;
};
export type prompt = {
    design_id: number;
    ment: string | null;
    upload_file_id: string | null;
};
export type scheduler_log = {
    id: Generated<number>;
    type: string | null;
    start_at: Timestamp | null;
    success_at: Timestamp | null;
    fail_at: Timestamp | null;
    is_publish: boolean | null;
};
export type token = {
    id: Generated<number>;
    user_id: string | null;
    token: string | null;
    created_at: Timestamp | null;
    expired_at: Timestamp | null;
};
export type upload_file = {
    id: string;
    file_name: string | null;
    url: string | null;
    created_at: Timestamp | null;
};
export type user_action_log = {
    id: Generated<number>;
    phone: string | null;
    pay_count: number | null;
    view: string | null;
    action: string | null;
    log_at: Timestamp | null;
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
    sample_type: number | null;
    deleted_at: Timestamp | null;
};
export type worldcup_log = {
    id: Generated<number>;
    photo_id: number | null;
    user_id: string | null;
    accessed_at: Timestamp | null;
    first_vote_at: Timestamp | null;
    last_vote_at: Timestamp | null;
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
    gemini_key: gemini_key;
    kakao_log: kakao_log;
    log_dev: log_dev;
    log_gemini_error: log_gemini_error;
    log_prompt: log_prompt;
    payments: payments;
    photo_code_log: photo_code_log;
    photo_results: photo_results;
    photo_share_code: photo_share_code;
    photos: photos;
    prompt: prompt;
    scheduler_log: scheduler_log;
    token: token;
    upload_file: upload_file;
    user_action_log: user_action_log;
    user_certification: user_certification;
    users: users;
    worldcup_log: worldcup_log;
    worldcup_votes: worldcup_votes;
};
