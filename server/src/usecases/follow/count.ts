import { AppError } from "../../errors.js";
import { countFollowBoth } from "../../services/follow/follow.js";

type Params = {
    userId: number;
};

// GET /follow/:id/count
// summary: フォロー・フォロワー数カウント取得
// page: フォロー・フォロワー数表示
export const countFollowUseCase = async ({ userId }: Params) => {
    const { followCount, followerCount } = await countFollowBoth({ userId });

    if (followCount === null || followerCount === null) {
        throw new AppError("NUMBER_NOT_FOUND", 404);
    }

    return { followCount, followerCount };
};
