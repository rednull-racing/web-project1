import type { Transaction } from "sequelize";
import { Follow, User } from "../../models/index.js";
import { FollowType } from "../../validators/query/follow.js";

export type FollowingsParams = {
    currentUserId: number;
    targetUserIds: number[];
};

export type UserParams = {
    currentUserId: number;
    targetUserId: number;
};

export type CountParams = {
    userId: number;
    transaction?: Transaction;
};

export type ListParams = {
    pageUserId: number;
    type: FollowType;
    keyword?: string;
};

export type DestroyParams = {
    follow: InstanceType<typeof Follow>;
};

export type DeleteFollowUserIdTransactionParams = {
    userId: number;
    transaction?: Transaction;
};

export type FollowWithUser = InstanceType<typeof Follow> & {
    FollowerUser: InstanceType<typeof User>;
    FollowUser: InstanceType<typeof User>;
};
