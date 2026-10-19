import { Item, Video } from "../../models/index.js";
import type {
    CreateVideoParams,
    PlayCountParams,
    UpdateStatusParams,
    UpdateVideoParams,
    VideoIdParams,
    VideoUserIdParams,
} from "../../types/serviceType/video.js";

export const getVideo = ({ videoId }: VideoIdParams) => {
    return Video.findByPk(videoId);
};

export const getMyVideo = ({ videoId, userId }: VideoUserIdParams) => {
    return Video.findOne({
        where: {
            id: videoId,
        },
        include: [
            {
                model: Item,
                attributes: [],
                where: { seller_id: userId },
                required: true,
            },
        ],
    });
};

export const addPlayCount = async ({ video, data }: PlayCountParams) => {
    await video.update(data);
};

export const createVideo = async ({ data, transaction }: CreateVideoParams): Promise<InstanceType<typeof Video>> => {
    return Video.create(data, { transaction });
};

export const updateStatus = async ({ video, data }: UpdateStatusParams) => {
    await video.update(data);
};

export const updateVideo = async ({ video, data, transaction }: UpdateVideoParams) => {
    await video.update(data, { transaction });
};
