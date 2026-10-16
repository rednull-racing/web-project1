import { AppError } from "../../errors.js";
import { destroyComment, getComment, getMyComment } from "../../services/comment/comment.js";
import { getItem } from "../../services/items/index.js";
import { createNotification } from "../../services/notification/notification.js";

type Params = {
    userId: number;
    commentId: number;
    page: "normal" | "admin";
};

// DELETE /comment/:id?page=""
// summary: コメント削除
// page: /item/[id]・/item/admin/[id]
export const deleteCommentUseCase = async ({ userId, commentId, page }: Params) => {
    // commentデータ取得
    let comment = null;

    if (page === "normal") {
        comment = await getMyComment({ commentId, userId });
    } else if (page === "admin") {
        comment = await getComment({ commentId });
    }

    if (!comment) throw new AppError("COMMENT_NOT_FOUND", 404);

    // itemデータ取得
    const item = await getItem({ itemId: comment.item_id });

    if (!item) throw new AppError("ITEM_NOT_FOUND", 404);

    // データ操作
    await destroyComment({ comment });

    const message =
        page === "admin"
            ? `利用規約違反が確認されたため、当該コメントが削除されました。「${comment.text}」`
            : `コメントを削除しました。「${comment.text}」`;

    createNotification({
        data: {
            read_user_id: userId,
            url: `/item/${item.id}`,
            message_image: item.first_image_url,
            message,
            type: page === "admin" ? "COMMENT_DELETED_BY_ADMIN" : "COMMENT",
        },
    }).catch((err) => {
        console.error("service createNotification error", err);
    });
};
