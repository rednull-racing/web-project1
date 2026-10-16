import { AppError } from "../../errors.js";
import { getItemByVideoId, updateSortNumber } from "../../services/items/index.js";
import { addPlayCount, getVideo } from "../../services/video/video.js";

type Params = {
    videoId: number;
    userId: number | null;
};

// PATCH /video/:id/onplay
// summary: 動画再生ログ更新
// page: /item
export const onPlayVideoUseCase = async ({ videoId, userId }: Params) => {
    // video取得
    const video = await getVideo({ videoId });

    if (!video) throw new AppError("VIDEO_NOT_FOUND", 404);

    // 再生回数 +1
    const newPlayCount = (video.play_count += 1);

    await addPlayCount({ video, data: { play_count: newPlayCount } });

    // item取得
    const item = await getItemByVideoId({ videoId: video.id });

    if (!item) throw new AppError("ITEM_NOT_FOUND", 404);

    // sort_number更新
    if (userId && item.status === "active") {
        const newSortNumber = Number(item.sort_number) + 15;
        const newSortBuzzNumber = Number(item.sort_buzz_number) + 70;

        await updateSortNumber({
            item,
            data: {
                sort_number: newSortNumber,
                sort_buzz_number: newSortBuzzNumber,
            },
        });
    }
};
