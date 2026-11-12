import type { ItemAttributes } from "@/types/itemAttributes";

export type Sale = {
    discount_rate: number | string | null;
    discount_amount: number | string | null;
    before_price: number | string | null;
    sale_flag: boolean;
};

export type Video = {
    title: string | null;
};

export type Item = {
    id: number;
    name: string | null;
    price: number | string;
    status: "active" | "soldout";
    gender_type: "men" | "women" | "unisex";
    age_type: "adult" | "kids" | "both";
    first_image_url: string | null;
    attributes?: ItemAttributes;
    uploaded_at?: string | null;
    Video: Video | null;
    Sale: Sale | null;
};

export type { ItemDraft } from "./draft/types";

export type ItemTrash = {
    id: number;
    name: string | null;
    price: number | string;
    first_image_url: string | null;
    title: string | null;
    createdAt: string;
};
