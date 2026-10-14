import { Transaction } from "sequelize";
import { Video } from "../../models/index.js";

export type VideoIdParams = {
    videoId: number;
};

export type VideoUserIdParams = {
    videoId: number;
    userId: number;
};

export type PlayCountParams = {
    video: InstanceType<typeof Video>;
    data: {
        play_count: number;
    };
};

export type CreateVideoParams = {
    itemId: number;
    userId: number;
    transaction: Transaction;
};

export type UpdateStatusParams = {
    video: InstanceType<typeof Video>;
    data: {
        status: string;
        converted_url?: string;
        duration?: number;
    };
};

export type UpdateVideoParams = {
    video: InstanceType<typeof Video>;
    data: {
        title: string;
        summary: string;
        original_url: string | null;
        thumbnail_url: string | null;
    };
    transaction: Transaction;
};
