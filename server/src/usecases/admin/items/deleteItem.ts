import crypto from "crypto";
import { SITE } from "../../../config/site.js";
import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { upsertCancel } from "../../../services/cancel.js";
import { updateDeliveryCancel } from "../../../services/delivery.js";
import { createItemDeleted } from "../../../services/itemDeleted.js";
import { createAdminItemDeleteLogs } from "../../../services/itemDeleteLogs.js";
import { destroyPerfectItem, getItemWithVideoSaleShipping } from "../../../services/items/index.js";
import { createNotification } from "../../../services/notification.js";
import { bulkCreateOrderDeleted } from "../../../services/orderDeleted.js";
import { getTradingOrdersAll, updateOrdersStatus } from "../../../services/orders.js";
import { createTransfer } from "../../../services/transfer.js";
import { getUserHasBankAccount } from "../../../services/users/query.js";
import { DeleteOrderType } from "../../../types/deleteOrderType.js";
import { moveToGlacier } from "../../../utils/moveToGlacier.js";

type Params = {
    itemId: number;
    adminId: number;
    deleteReason: string;
};

// DELETE /admin/items/:id
// summary: 商品強制削除
// page: /item/admin/[id]
export const deleteAdminItemUseCase = async ({ itemId, adminId, deleteReason }: Params) => {
    const nowDate = new Date();

    // 2週間後金曜日
    const twoWeeksLater = new Date(nowDate);
    twoWeeksLater.setDate(nowDate.getDate() + 14);

    const dayOfWeek = twoWeeksLater.getDay();
    const dayUntilFriday = (5 - dayOfWeek + 7) % 7;
    twoWeeksLater.setDate(twoWeeksLater.getDate() + dayUntilFriday);

    // item取得
    const item = await getItemWithVideoSaleShipping({ itemId });

    if (!item) throw new AppError("ITEM_NOT_FOUND", 404);

    const sellerId = Number(item.seller_id);

    // 取引中orders
    const orders = await getTradingOrdersAll({ itemId });

    await sequelize.transaction(async (t) => {
        // お知らせ作成
        await createNotification({
            data: {
                type: "ITEM_DELETED_BY_ADMIN",
                read_user_id: sellerId,
                url: `/profile/${sellerId}`,
                message: `平素より${SITE.appName}をご利用いただき誠にありがとうございます。社内で慎重に協議した結果、利用規約違反が確認されたため、「${item.name}」を削除しました。削除理由は以下の通りです。「${deleteReason}」。今後とも利用規約に沿ったご利用をお願いいたします。`,
            },
            transaction: t,
        });

        const deleteOrder: DeleteOrderType[] = [];

        if (orders && orders.length > 0) {
            for (const order of orders) {
                if (!order.buyer_user_id) break;

                await updateOrdersStatus({
                    order,
                    data: { status: "cancelled" },
                    transaction: t,
                });

                if (order.Delivery) {
                    await updateDeliveryCancel({
                        delivery: order.Delivery,
                        data: { cancel: true },
                        transaction: t,
                    });
                }

                await upsertCancel({
                    data: {
                        orders_id: order.id,
                        cancel_reason: "商品削除",
                        return_amount: Number(order.total_amount),
                        item_count: Number(order.item_count),
                        cancel_flag: true,
                        cancel_fee_return_id: 2,
                    },
                    transaction: t,
                });

                const buyer = await getUserHasBankAccount({ userId: order.buyer_user_id });

                if (!buyer) {
                    throw new AppError("BUYER_NOT_FOUND", 404);
                }

                const account = buyer.BankAccount;
                const buyerHasAccount = !!account;

                const message =
                    `[重要] 取引中の商品「${item.name}」は利用規約違反により削除され、取引はキャンセル・返金となりました。` +
                    `購入費用は全額お客様の口座に返金されます。なお、お振込日は本日から翌々週の金曜日以降となります。ご迷惑をおかけいたしますが、ご対応のほどよろしくお願いします。` +
                    `${
                        buyerHasAccount
                            ? "口座情報が未登録です。至急口座を登録してください。30日以内に登録がない場合、返金できませんのでご注意ください。"
                            : ""
                    }`;

                await createNotification({
                    data: {
                        read_user_id: buyer.id,
                        message_image: item.first_image_url,
                        message,
                        type: "ORDER_DELETE",
                    },
                    transaction: t,
                });

                const transferId = crypto.randomBytes(11).toString("hex");

                await createTransfer({
                    data: {
                        request_money: Number(order.total_amount),
                        handling_charge: 0,
                        trans_money: Number(order.total_amount),
                        trans_reason_id: 2,
                        trans_schedule_date: twoWeeksLater,
                        user_id: buyer.id,
                        transfer_id: transferId,
                        bank_snapshot: {
                            bank_name: account?.bank_name ?? "",
                            branch_name: account?.branch ?? "",
                            account_type: account?.account_type ?? "",
                            account_number: account?.account_number ?? "",
                            meigi: account?.meigi ?? "",
                        },
                    },
                    transaction: t,
                });

                deleteOrder.push({
                    orders_id: order.id,
                    delivery_id: Number(order.Delivery?.id),
                    cancel_reason: "出品者削除",
                    refund_status: "未返金",
                    refund_method: "口座振込",
                    refund_amount: Number(order.total_amount),
                    deleted_by: adminId,
                });

                // メール送信処理
            }

            await bulkCreateOrderDeleted({
                data: deleteOrder,
                transaction: t,
            });
        }

        let newImages: string[] = [];
        if (item.image_url && item.image_url.length > 0) {
            const movedImages = await Promise.all(
                item.image_url.map((url: string) => moveToGlacier({ userId: sellerId, url })),
            );
            newImages = movedImages.filter((url): url is string => url !== null);
        }

        let newVideoUrl = null;
        let newThumbnailUrl = null;
        if (item.Video) {
            const videoUrl = item.Video.converted_url || item.Video.original_url || undefined;

            if (videoUrl) {
                newVideoUrl = await moveToGlacier({ userId: sellerId, url: videoUrl });
            }

            if (item.Video.thumbnail_url) {
                newThumbnailUrl = await moveToGlacier({
                    userId: sellerId,
                    url: item.Video.thumbnail_url,
                });
            }
        }

        await createItemDeleted({
            data: {
                item_id: item.id,
                seller_id: sellerId,
                item_name: String(item.name),
                detail: String(item.detail),
                price: Number(item.price),
                image_url: newImages,
                video_url: newVideoUrl,
                thumbnail_url: newThumbnailUrl,
                video_title: item.Video ? item.Video.title : null,
                video_summary: item.Video ? item.Video.summary : null,
                delete_reason: "強制削除",
                deleted_by: adminId,
            },
            transaction: t,
        });

        await createAdminItemDeleteLogs({
            data: {
                item_id: item.id,
                delete_user_id: adminId,
                delete_by_admin: true,
                delete_reason: "強制削除",
            },
            transaction: t,
        });

        await destroyPerfectItem({
            item,
            transaction: t,
        });
    });

    // メール送信処理
};
