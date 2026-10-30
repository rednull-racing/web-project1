export type PointLots = {
    id: string;
    points: number;
    used_points: number;
    expires_at: Date;
    alertPoints: number;
};

export type UriagekinLots = {
    id: string;
    uriagekin: number;
    used_uriagekin: number;
    expires_at: Date;
    alertUriagekin: number;
};

export type User = {
    id: number;
    user_name: string;
    profile_image: string;
    early_seller: boolean;
    honnin_verified: boolean;
    points: number;
    uriagekin: number;
    PointLots: PointLots | null;
    UriagekinLots: UriagekinLots | null;
};

export type Res = {
    userData: {
        user: User;
        hasShop: boolean;
    };
    itemCount: number;
    soldItemCount: number;
    unreadCount: number;
    referenceCount: number;
};
