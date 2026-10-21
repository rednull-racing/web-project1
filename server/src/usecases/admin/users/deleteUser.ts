import bcrypt from "bcrypt";
import crypto from "crypto";
import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { Item } from "../../../models/index.js";
import { upsertCancel } from "../../../services/cancel/cancel.js";
import { deleteCartUserLogical } from "../../../services/cart/cart.js";
import { deleteCommentUserLogical } from "../../../services/comment/comment.js";
import { deleteCommentLikeUserLogical } from "../../../services/commentLike/commentLike.js";
import { updateDeliveryCancel } from "../../../services/delivery/delivery.js";
import { deleteFollowerUserLogical, deleteFollowUserLogical } from "../../../services/follow/follow.js";
import { bulkCreateItemDeleted } from "../../../services/itemDeleted/itemDeleted.js";
import { bulkCreateItemDeleteLogs } from "../../../services/itemDeleteLogs/itemDeleteLogs.js";
import { deleteItemLikeUserLogical } from "../../../services/itemLike/itemLike.js";
import { destroyPerfectItem, getMyItemsWithVideoAll } from "../../../services/items/index.js";
import { createJournal } from "../../../services/journal/journal.js";
import { createNotification, deleteNotificationUserLogical } from "../../../services/notification/notification.js";
import { bulkCreateOrderDeleted } from "../../../services/orderDeleted/orderDeleted.js";
import { getTradingOrdersAll, updateOrdersStatus } from "../../../services/orders/orders.js";
import { updatePointLots } from "../../../services/pointLots/pointLots.js";
import { createOverConfiscated } from "../../../services/pointsUriageOver/pointsUriageOver.js";
import {
    deleteInputCodeUserLogical,
    deleteOutputCodeUserLogical,
} from "../../../services/referenceCode/referenceCode.js";
import {
    createTransfer,
    deleteTransferUserLogical,
    sumTransferNotFinishUser,
} from "../../../services/transfer/transfer.js";
import { updateUsedUriagekin } from "../../../services/uriagekinLots/uriagekinLots.js";
import { createUserDeleteLogs } from "../../../services/userDeleteLogs/userDeleteLogs.js";
import { updateUserLogicalDelete } from "../../../services/users/command.js";
import { getUserHasBankAccount, getUserHasUriagekinPointBank } from "../../../services/users/query.js";
import { deleteWatchHistoryUserLogical } from "../../../services/watchHistory/watchHistory.js";
import { DeleteOrderType } from "../../../types/deleteOrderType.js";
import { moveToGlacier } from "../../../utils/moveToGlacier.js";
import { createBuyerRefundBankSnapshot, createBuyerRefundNotificationMessage } from "./deleteUserRefund.js";

type Params = {
    pageUserId: number;
    adminId: number;
    deleteReason: string;
};

type DeleteItemDataType = {
    item_id: number;
    seller_id: number;
    item_name: string;
    detail: string;
    price: number;
    image_url: string[];
    video_url: string | null;
    thumbnail_url: string | null;
    video_title: string | null;
    video_summary: string | null;
    delete_reason: string;
    deleted_by: number;
};

type NewItemDeleteLogType = {
    item_id: number;
    delete_user_id: number;
    delete_by_admin: boolean;
    delete_reason: string;
};

// DELETE /admin/user/:id
// summary: ユーザー強制削除
// page: /profile/admin/[id]
export const deleteUserAdminUseCase = async ({ pageUserId, adminId, deleteReason }: Params) => {
    const nowDate = new Date();

    // user取得
    const user = await getUserHasUriagekinPointBank({ userId: pageUserId });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);

    // 出品した商品取得
    const items = await getMyItemsWithVideoAll({ userId: pageUserId });

    // 売上金・ポイント・未振込金回収
    const transferMoney = await sumTransferNotFinishUser({ userId: pageUserId });

    const uriagekinAll = Number(user.uriagekin);
    const pointsAll = Number(user.points);

    let deleteUriage = uriagekinAll;
    let deletePoints = pointsAll;

    await sequelize.transaction(async (t) => {
        // uriagekinLots.used_uriagekin
        if (user.UriagekinLots) {
            for (const data of user.UriagekinLots) {
                if (deleteUriage <= 0) break;

                const available = Number(data.uriagekin);
                const usedUriagekin = Number(data.used_uriagekin) || 0;
                const remain = available - usedUriagekin;

                if (remain <= 0) continue;

                const used = Math.min(remain, deleteUriage);

                await updateUsedUriagekin({
                    lots: data,
                    data: {
                        used_uriagekin: usedUriagekin + used,
                    },
                    transaction: t,
                });

                deleteUriage -= used;
            }
        }

        // PointLots.used_points
        if (user.PointLots) {
            for (const pointLot of user.PointLots) {
                if (deletePoints <= 0) break;

                const available = Number(pointLot.points);
                const usedPoints = Number(pointLot.used_points) || 0;
                const remain = available - usedPoints;

                if (remain <= 0) continue;

                const used = Math.min(remain, deletePoints);

                await updatePointLots({
                    lot: pointLot,
                    data: {
                        used_points: usedPoints + used,
                    },
                    transaction: t,
                });

                deletePoints -= used;
            }
        }

        await createOverConfiscated({
            data: {
                points_confiscated: pointsAll,
                uriagekin_confiscated: uriagekinAll,
            },
            transaction: t,
        });

        // 帳簿作成
        await createJournal({
            data: {
                kanjyo_kari1: 3,
                kanjyo_kashi1: 6,
                price_kari1: uriagekinAll,
                price_kashi1: uriagekinAll,
                reason_id: 8,
            },
            transaction: t,
        });

        await createJournal({
            data: {
                kanjyo_kari1: 8,
                kanjyo_kashi1: 6,
                price_kari1: pointsAll,
                price_kashi1: pointsAll,
                reason_id: 9,
            },
            transaction: t,
        });

        await createJournal({
            data: {
                kanjyo_kari1: 3,
                kanjyo_kashi1: 6,
                price_kari1: transferMoney,
                price_kashi1: transferMoney,
                reason_id: 11,
            },
            transaction: t,
        });

        await createUserDeleteLogs({
            data: {
                user_id: pageUserId,
                delete_reason: deleteReason,
                deleted_by_admin: true,
                admin_id: adminId,
            },
            transaction: t,
        });

        await deleteCartUserLogical({ userId: pageUserId, transaction: t });
        await deleteFollowUserLogical({ userId: pageUserId, transaction: t });
        await deleteFollowerUserLogical({ userId: pageUserId, transaction: t });
        await deleteCommentLikeUserLogical({ userId: pageUserId, transaction: t });
        await deleteItemLikeUserLogical({ userId: pageUserId, transaction: t });
        await deleteInputCodeUserLogical({ userId: pageUserId, transaction: t });
        await deleteOutputCodeUserLogical({ userId: pageUserId, transaction: t });
        await deleteNotificationUserLogical({ userId: pageUserId, transaction: t });
        await deleteWatchHistoryUserLogical({ userId: pageUserId, transaction: t });
        await deleteCommentUserLogical({ userId: pageUserId, transaction: t });
        await deleteTransferUserLogical({ userId: pageUserId, transaction: t });

        // item削除
        if (items.length > 0) {
            const deleteItemsData: DeleteItemDataType[] = [];
            const newItemDeleteLogs: NewItemDeleteLogType[] = [];

            for (const item of items) {
                const itemId = item.id;

                // 取引中データ取得
                const orders = await getTradingOrdersAll({ itemId });

                if (orders && orders.length > 0) {
                    const twoWeeksLater = new Date(nowDate);
                    twoWeeksLater.setDate(nowDate.getDate() + 14);

                    const dayOfWeek = twoWeeksLater.getDay();
                    const dayUntilFriday = (5 - dayOfWeek + 7) % 7;
                    twoWeeksLater.setDate(twoWeeksLater.getDate() + dayUntilFriday);

                    const deleteOrder: DeleteOrderType[] = [];

                    // 取引中データ更新処理
                    for (const order of orders) {
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

                        const buyer = await getUserHasBankAccount({ userId: Number(order.buyer_user_id) });

                        if (!buyer) throw new AppError("USER_NOT_FOUND", 404);

                        const buyerAccount = buyer.BankAccount;
                        const message = createBuyerRefundNotificationMessage({
                            itemName: String(item.name),
                            buyerHasAccount: !!buyerAccount,
                        });

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
                                bank_snapshot: createBuyerRefundBankSnapshot(buyerAccount),
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
                    newImages = (
                        await Promise.all(
                            item.image_url.map((url: string) => moveToGlacier({ userId: pageUserId, url })),
                        )
                    ).filter((url): url is string => url !== null);
                }

                let newVideoUrl = null;
                let newThumbnailUrl = null;
                if (item.Video) {
                    const videoUrl = item.Video.converted_url || item.Video.original_url || undefined;

                    if (videoUrl) {
                        newVideoUrl = await moveToGlacier({ userId: pageUserId, url: videoUrl });
                    }

                    if (item.Video.thumbnail_url) {
                        newThumbnailUrl = await moveToGlacier({
                            userId: pageUserId,
                            url: item.Video.thumbnail_url,
                        });
                    }
                }

                // 商品削除ログ作成
                deleteItemsData.push({
                    item_id: item.id,
                    seller_id: Number(item.seller_id),
                    item_name: String(item.name),
                    detail: String(item.detail),
                    price: Number(item.price),
                    image_url: newImages,
                    video_url: newVideoUrl,
                    thumbnail_url: newThumbnailUrl,
                    video_title: item.Video ? item.Video.title : null,
                    video_summary: item.Video ? item.Video.summary : null,
                    delete_reason: "強制削除、ユーザー削除",
                    deleted_by: adminId,
                });

                newItemDeleteLogs.push({
                    item_id: item.id,
                    delete_user_id: adminId,
                    delete_by_admin: true,
                    delete_reason: "強制削除、ユーザー削除",
                });
            }

            await bulkCreateItemDeleted({
                data: deleteItemsData,
                transaction: t,
            });

            await bulkCreateItemDeleteLogs({
                data: newItemDeleteLogs,
                transaction: t,
            });

            // 商品完全削除
            await Promise.all(
                items.map(async (item: InstanceType<typeof Item>) => {
                    await destroyPerfectItem({
                        item,
                        transaction: t,
                    });
                }),
            );
        }

        // ユーザー論理削除
        const dummyPassword = `deleted${pageUserId}`;
        const hashedDummy = await bcrypt.hash(dummyPassword, 10);

        await updateUserLogicalDelete({
            user,
            data: {
                user_name: "削除済みユーザー",
                user_introduction: null,
                profile_image: null,
                penalty_points: 0,
                early_seller: false,
                honnin_verified: false,
                email: `deleted-${pageUserId}@deleted.local`,
                campaign_points: 0,
                campaign_points_sum: 0,
                password: hashedDummy,
                points: 0,
                uriagekin: 0,
                star_amount: 0,
                star_average: 0,
                gender_id: null,
                birthday: null,
                phone_number: null,
                honnin_verify_request: false,
                email_verified: false,
            },
            transaction: t,
        });
    });

    // メール送信処理
};
