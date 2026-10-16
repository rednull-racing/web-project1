import { NotificationType } from "../../../config/notification.js";
import { getMyNotificationAll, updateNotificationType } from "../../../services/notification/notification.js";

const MESSAGE_TYPE_MAP: { pattern: string; type: NotificationType }[] = [
    { pattern: "コメントを削除しました", type: "COMMENT" },
    { pattern: "下書きを作成しました", type: "ITEM" },
    { pattern: "復元しました", type: "ITEM" },
    { pattern: "出品いただき", type: "ITEM" },
    { pattern: "削除から1か月間はマイページの「削除した商品」", type: "ITEM" },
    { pattern: "ポイントに変換しました", type: "TRANSFER" },
    { pattern: "振込申請しました", type: "TRANSFER" },
    { pattern: "本人確認を開始しました", type: "USER_EDIT" },
    { pattern: "審査完了まで1~2週間ほどお時間を頂戴しておりますため", type: "SHOP_EDIT" },
    { pattern: "審査完了までしばらくお待ちください", type: "SHOP_EDIT" },
    { pattern: "コメントが削除されました", type: "COMMENT_DELETED_BY_ADMIN" },
    { pattern: "社内で慎重に協議した結果、利用規約違反が確認されたため、", type: "ITEM_DELETED_BY_ADMIN" },
    { pattern: "重大な規約違反が確認されたため、売上金", type: "URIAGE_DELETED_BY_ADMIN" },
    // ↑ 増やすだけでOK！
];

export class editTypeUseCase {
    async execute() {
        const allNotification = await getMyNotificationAll();

        for (const notification of allNotification) {
            if (!notification.message.trim()) break;

            const matched = MESSAGE_TYPE_MAP.find(({ pattern }) => notification.message.includes(pattern));

            const type = matched?.type ?? "UNKNOWN";
            console.log(type);

            updateNotificationType({
                notification,
                data: { type },
            }).catch((err) => {
                console.log("service notification updateType error", err);
            });
        }
    }
}
