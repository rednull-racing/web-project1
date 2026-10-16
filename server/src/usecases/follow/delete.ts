import { AppError } from "../../errors.js";
import { destroyFollow, getFollowOne } from "../../services/follow/follow.js";

type Params = {
    currentUserId: number;
    targetUserId: number;
};

// DELETE /follow/:id
// summary: フォロー削除
// page: フォローボタンがあるページ
export const deleteFollowUseCase = async ({ currentUserId, targetUserId }: Params) => {
    // targetUserIdバリデーション
    if (currentUserId === targetUserId) {
        throw new AppError("INVALID_USER_ID", 400);
    }

    // follow取得
    const follow = await getFollowOne({ currentUserId, targetUserId });

    if (!follow) {
        throw new AppError("NOT_FOLLOWING", 409);
    }

    // follow削除
    await destroyFollow({ follow });
};
