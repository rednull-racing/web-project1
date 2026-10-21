import { getFollowOne } from "../../services/follow/follow.js";

type Params = {
    currentUserId: number;
    targetUserId: number;
};

// GET /follow/:id/status
// summary: フォローステータス取得
// page: フォローボタンがあるページ
export const getFollowStatusUseCase = async ({ currentUserId, targetUserId }: Params) => {
    const isFollowing = await getFollowOne({ currentUserId, targetUserId });

    return !!isFollowing;
};
