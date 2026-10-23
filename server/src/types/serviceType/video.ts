import type { Transaction } from "sequelize";
import type { Video } from "../../models/index.js";

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
    data: Pick<
        InstanceType<typeof Video>,
        "thumbnail_url" | "title" | "summary" | "duration" | "play_count" | "original_url" | "converted_url" | "status"
    >;
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
    data: Omit<CreateVideoParams["data"], "play_count">;
    transaction: Transaction;
};
