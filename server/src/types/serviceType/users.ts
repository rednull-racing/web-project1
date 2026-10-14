import { Op } from "sequelize";
import type { Order, Transaction, WhereOptions } from "sequelize";
import { User } from "../../models/index.js";

export type UserIdParams = {
    userId: number;
};

export type UserIdWhereParams = {
    userId: number;
    where: WhereOptions;
    order?: Order;
    limit?: number;
};

export type GetMyPageParams = {
    userId: number;
    pointLotsWhere: WhereOptions;
    uriagekinLotsWhere: WhereOptions;
    order?: Order;
    limit?: number;
};

export type GetUserAllParams = {
    where?: {
        id?: {
            [Op.gt]: number;
        };
    };
    limit?: number;
};

export type EmailParams = {
    email: string;
};

export type CreateUserParams = {
    data: {
        email: string;
        password: string;
        user_name: string;
    };
    transaction?: Transaction;
};

export type EmailVerifyParams = {
    user: InstanceType<typeof User>;
    data: {
        email_verified: boolean;
        address_id: number;
        name_id: number;
        account_id: number;
        idcard_id: number;
    };
    transaction?: Transaction;
};

export type UpdatePasswordParams = {
    user: InstanceType<typeof User>;
    data: {
        password: string;
    };
    transaction?: Transaction;
};

export type UpdateEmailParams = {
    user: InstanceType<typeof User>;
    data: {
        email: string;
    };
    transaction?: Transaction;
};

export type UpdatePhoneNumberParams = {
    user: InstanceType<typeof User>;
    data: {
        phone_number: string;
    };
    transaction?: Transaction;
};

export type UpdateProfileParams = {
    user: InstanceType<typeof User>;
    data: {
        user_name: string;
        user_introduction: string | null;
        profile_image: string | null;
    };
    transaction?: Transaction;
};

export type UpdateHonninParams = {
    user: InstanceType<typeof User>;
    data: {
        honnin_verify_request: boolean;
        honnin_verified: boolean;
        birthday: Date;
        phone_number: string;
        gender_id: number;
    };
    transaction?: Transaction;
};

export type UpdateUserPointsUriageParams = {
    user: InstanceType<typeof User>;
    data: {
        points: number;
        uriagekin: number;
    };
    transaction?: Transaction;
};

export type UpdateUserUriageParams = {
    user: InstanceType<typeof User>;
    data: {
        uriagekin: number;
    };
    transaction?: Transaction;
};

export type UpdateUserPenaltyParams = {
    user: InstanceType<typeof User>;
    data: {
        penalty_points: number;
    };
    transaction?: Transaction;
};

export type UpdateUserIdCardIdParams = {
    user: InstanceType<typeof User>;
    data: {
        idcard_id: number;
    };
    transaction?: Transaction;
};

export type UpdateUserLogicalDeleteParams = {
    user: InstanceType<typeof User>;
    data: {
        user_name: string;
        user_introduction: null;
        profile_image: null;
        penalty_points: number;
        early_seller: boolean;
        honnin_verified: boolean;
        email: string;
        campaign_points: number;
        campaign_points_sum: number;
        password: string;
        points: number;
        uriagekin: number;
        star_amount: number;
        star_average: number;
        gender_id: null;
        birthday: null;
        phone_number: null;
        honnin_verify_request: boolean;
        email_verified: boolean;
    };
    transaction?: Transaction;
};

export type DestroyUnverifiedUsersParams = {
    userIds: number[];
    transaction: Transaction;
};

export type GetCronUserTrustScoreParams = {
    createdBefore: Date;
    reportTrustScore: number;
};

export type UpdateReportTrustScoreUserParams = {
    user: InstanceType<typeof User>;
    data: {
        report_trust_score: number;
    };
    transaction: Transaction;
};
