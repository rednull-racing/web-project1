export type UserListResponse = {
    userList: User[];
    nextCursor: string | null;
    hasMore: boolean;
};

export type Follow = {
    id: string;
    follow_user_id: string | number;
    follower_user_id: string | number;
};

export type ShopInfo = {
    id: string;
};

export type User = {
    id: string;
    user_name: string;
    profile_image: string;
    honnin_verified: boolean;
    early_seller: boolean;
    is_following: boolean;
    ShopInfo: ShopInfo | null;
};

export type ItemLike = {
    id: string;
    User: User | null;
};
