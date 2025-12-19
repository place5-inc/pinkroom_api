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
    order_seq: number;
};
export type code_hair_style = {
    id: Generated<number>;
    name: string;
    published_at: Timestamp | null;
    order_seq: number;
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
export type users = {
    id: Generated<number>;
    phone: string | null;
    created_at: Timestamp | null;
};
export type DB = {
    code_hair_design: code_hair_design;
    code_hair_style: code_hair_style;
    prompt: prompt;
    upload_file: upload_file;
    users: users;
};
