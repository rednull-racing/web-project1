import type { ItemAttributes } from "@/types/itemAttributes";

export type ItemConditionOption = {
    id: string;
    name: string;
};

export type ShippingDayOption = {
    id: string;
    name: string;
};

export type ShippingServiceOption = {
    id: string;
    name: string;
};

export type TodouhukenOption = {
    id: string;
    name: string;
};

export type ShopInfo = {
    id: string;
};

export type Brand = {
    id: string;
    name: string;
};

export type Categories = {
    id: string;
    name: string;
    level: number;
    allowed_gender: "men" | "women" | "both";
    allowed_age: "adult" | "kids" | "both";
    parent?: Categories | null;
    children?: Categories | null;
};

export type ItemShippingProfile = {
    id: string;
    ShippingDayOption?: ShippingDayOption | null;
    ShippingServiceOption?: ShippingServiceOption | null;
    TodouhukenOption?: TodouhukenOption | null;
    shipping_service_free_text?: string | null;
};

export type User = {
    id: string;
    user_name: string;
    profile_image: string;
    early_seller: boolean;
    honnin_verified: boolean;
    star_amount: number;
    star_average: number;
    ShopInfo?: ShopInfo | null;
};

export type Comment = {
    id: string;
    text: string;
    sort_number: number;
    item_id: string;
    user_id: string;
    parent_comment_id: string;
    createdAt: Date;
    updatedAt: Date;
    pin: boolean;
    replyCount: number;
    isMyComment: boolean;
    isGoodByMe: boolean;
    goodCount: number;
    reportCount: number;
    User?: User | null;
    Item?: Item | null;
};

export type Sale = {
    id: string;
    before_price: number;
    discount_rate: number;
    discount_amount: number;
    sale_flag: boolean;
};

export type Video = {
    id: string;
    thumbnail_url: string;
    title: string;
    summary: string;
    duration: string;
    play_count: number;
    original_url: string;
    converted_url: string;
    status: string;
};

export type Item = {
    id: string;
    name: string;
    detail: string;
    image_url: string[];
    first_image_url: string;
    price: number;
    seller_id: number;
    status: "active" | "soldout";
    early_sell: boolean;
    updatedAt: Date;
    uploaded_at: Date;
    save_at: Date;
    deleted_at: Date;
    gender_type: "men" | "women" | "unisex";
    age_type: "adult" | "kids" | "both";
    attributes: ItemAttributes;
    recommend: boolean;
    ItemConditionOption?: ItemConditionOption | null;
    User?: User | null;
    Video?: Video | null;
    Sale?: Sale | null;
    ItemShippingProfile?: ItemShippingProfile | null;
    Category?: Categories | null;
    Brand?: Brand | null;
};
