import sequelize from "../../db.js";
import { AppError } from "../../errors.js";
import { createNotification } from "../../services/notification/notification.js";
import { createTransfer } from "../../services/transfer/transfer.js";
import { updateUsedUriagekin } from "../../services/uriagekinLots/uriagekinLots.js";
import { updateUriageUser } from "../../services/users/command.js";
import { getUserHasUriagekinPointBank } from "../../services/users/query.js";
import { generateTransferId } from "../../utils/generateTransferId.js";

type Params = {
    userId: number;
    requestValue: number;
    limit: number;
};

// POST /transfer/request
// summary: 振込申請データ作成
// page: /transfer/request
export const createTransferRequestUseCase = async ({ userId, requestValue, limit }: Params) => {
    // bodyバリデーション
    if (requestValue < 1000) throw new AppError("INVALID_VALUE_MIN_1000", 400);
    if (requestValue > limit) throw new AppError("INVALID_VALUE_MAX_LIMIT", 400);

    const transValue = requestValue - 200;

    // 翌々週金曜日算出
    const today = new Date();

    const dayOfWeek = today.getDay();

    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;

    const thisFriday = new Date(today);
    thisFriday.setDate(today.getDate() + daysUntilFriday);

    const nextNextFriday = new Date(thisFriday);
    nextNextFriday.setDate(thisFriday.getDate() + 14);

    // user取得
    const user = await getUserHasUriagekinPointBank({ userId });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);

    const account = user.BankAccount;

    // transferId取得
    const transferId = await generateTransferId();

    // uriagekinHistory削除
    const oldUriagekin = user.uriagekin;

    let deleteValue = requestValue;

    // aとbを日時の数値に変換して引き算
    // → マイナスならaが前、プラスならbが前
    // → 結果として「古い順（昇順）」に並ぶ
    const lots = [...(user.UriagekinLots ?? [])].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const transId = await sequelize.transaction(async (t) => {
        // UriagekinLots古い順に削除
        for (const data of lots) {
            if (deleteValue <= 0) break;

            const available = Number(data.uriagekin);
            const usedUriagekin = Number(data.used_uriagekin) || 0;
            const remain = available - usedUriagekin;

            if (remain <= 0) continue;

            const used = Math.min(remain, deleteValue);

            await updateUsedUriagekin({
                lots: data,
                data: {
                    used_uriagekin: usedUriagekin + used,
                },
                transaction: t,
            });

            deleteValue -= used;
        }

        await updateUriageUser({
            user,
            data: {
                uriagekin: Number(oldUriagekin) - requestValue,
            },
            transaction: t,
        });

        const transfer = await createTransfer({
            data: {
                request_money: requestValue,
                handling_charge: 200,
                trans_money: transValue,
                trans_reason_id: 1,
                user_id: userId,
                trans_schedule_date: nextNextFriday,
                transfer_id: transferId,
                bank_snapshot: {
                    bank_name: String(account?.bank_name),
                    branch_name: String(account?.branch),
                    account_type: account?.account_type ?? "ordinary",
                    account_number: String(account?.account_number),
                    meigi: String(account?.meigi),
                },
            },
            transaction: t,
        });

        return transfer.id;
    });

    // メール送信機能

    // お知らせ作成
    createNotification({
        data: {
            read_user_id: userId,
            url: `/transfer/detail/${transId}`,
            message: `${transValue.toLocaleString()}円を振込申請しました。翌々週の金曜日以降に指定された口座までお振込みいたします。詳細はこちらをクリックしてご確認ください。`,
            type: "TRANSFER",
        },
    }).catch((err) => {
        console.error("service createNotification error:", err);
    });

    return transId;
};
