import { getItemLikeList } from "../../services/itemLike/itemLike.js";
import { getFollowings } from "../../services/follow/follow.js";

type Params = {
    itemId: number;
    userId: number;
    keyword?: string;
};

// GET /item-like/:id/user(?keyword="")
// summary: いいねしたユーザーリスト取得
// page: /user-list/item-like/[id]
export const getItemLikeUserListUseCase = async ({ itemId, userId, keyword }: Params) => {
    // いいねリスト取得
    const itemLikeList = await getItemLikeList({ itemId, keyword });

    // フォロー状態の付与
    let finalLikeList = null;

    if (userId !== null) {
        const targetUserIds = itemLikeList.map((item) => item.User.id);

        const currentUserId = userId;

        const followings = await getFollowings({ currentUserId, targetUserIds });

        const followingUserIdSet = new Set(followings.map((f) => f.follower_user_id));

        finalLikeList = itemLikeList.map((item) => {
            const plainItem = item.toJSON();
            const targetId = plainItem.User?.id;
            plainItem.User.is_following = followingUserIdSet.has(targetId);
            return plainItem;
        });
    }

    // ユーザー情報だけ返す
    const source = finalLikeList ?? itemLikeList;

    const userList = source.map((item) => {
        const plain = item.toJSON ? item.toJSON() : item;
        return plain.User;
    });

    return userList;
};
