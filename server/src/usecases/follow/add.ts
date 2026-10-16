import { AppError } from "../../errors.js";
import { createFollow, getFollowOne } from "../../services/follow/follow.js";

type Params = {
    currentUserId: number;
    targetUserId: number;
};

// POST /follow/:id
// summary: フォロー作成
// page: フォローボタンがあるページ
export const addFollowUseCase = async ({ currentUserId, targetUserId }: Params) => {
    // targetUserIdバリデーション
    if (currentUserId === targetUserId) {
        throw new AppError("INVALID_USER_ID", 400);
    }

    // follow取得
    const follow = await getFollowOne({ currentUserId, targetUserId });

    if (follow) {
        throw new AppError("ALREADY_FOLLOWING", 409);
    }

    // follow作成
    await createFollow({ currentUserId, targetUserId });
};
