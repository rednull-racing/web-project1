import { Video } from "../models/index.js";
import {
    CreateVideoParams,
    PlayCountParams,
    UpdateStatusParams,
    UpdateVideoParams,
    VideoIdParams,
    VideoUserIdParams,
} from "../types/serviceType/video.js";

export const getVideo = ({ videoId }: VideoIdParams) => {
    return Video.findByPk(videoId);
};

export const getMyVideo = ({ videoId, userId }: VideoUserIdParams) => {
    return Video.findOne({
        where: {
            id: videoId,
            user_id: userId,
        },
    });
};

export const addPlayCount = async ({ video, data }: PlayCountParams) => {
    await video.update(data);
};

export const createVideo = async ({ itemId, userId, transaction }: CreateVideoParams) => {
    await Video.create(
        {
            user_id: userId,
            item_id: itemId,
        },
        { transaction },
    );
};

export const updateStatus = async ({ video, data }: UpdateStatusParams) => {
    await video.update(data);
};

export const updateVideo = async ({ video, data, transaction }: UpdateVideoParams) => {
    await video.update(data, { transaction });
};
