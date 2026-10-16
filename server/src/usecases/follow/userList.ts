import { getFollowings, getFollowList } from "../../services/follow/follow.js";
import { FollowType } from "../../validators/query/follow.js";

type Params = {
    currentUserId: number | null;
    pageUserId: number;
    type: FollowType;
    keyword?: string;
};

// GET /follow/:id/user?type=""(&keyword="")
// summary: フォロー・フォロワーリスト取得
// page: /user-list/follow/[id]
export const getFollowUserListUseCase = async ({ currentUserId, pageUserId, type, keyword }: Params) => {
    const myFollow = currentUserId === pageUserId && type === "follow";

    // フォロー・フォロワーのリスト
    const followList = await getFollowList({ pageUserId, type, keyword });

    const as = type === "follow" ? "FollowerUser" : "FollowUser";

    // 自分がフォローしているかどうか（is_following）を追加
    let finalFollowList = null;

    if (currentUserId !== null && followList.length > 0 && !myFollow) {
        const targetUserIds = followList.map((user) => user[as].id);

        const followings = await getFollowings({ currentUserId, targetUserIds });

        const followingUserIdSet = new Set(followings.map((f) => f.follower_user_id));

        finalFollowList = followList.map((item) => {
            const plainItem = item.toJSON();
            const targetId = plainItem[as]?.id;
            plainItem[as].is_following = followingUserIdSet.has(targetId);
            return plainItem;
        });
    }

    const source = finalFollowList ?? followList;

    const userList = source.map((item) => {
        const plain = item.toJSON ? item.toJSON() : item;
        return plain[as];
    });

    return userList;
};
