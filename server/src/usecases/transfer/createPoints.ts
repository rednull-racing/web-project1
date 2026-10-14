import sequelize from "../../db.js";
import { AppError } from "../../errors.js";
import { createJournal } from "../../services/journal.js";
import { createNotification } from "../../services/notification.js";
import { createPointLots } from "../../services/pointLots.js";
import { createPointsHistory } from "../../services/pointsHistory.js";
import { updateUsedUriagekin } from "../../services/uriagekinLots.js";
import { updatePointsUriageUser } from "../../services/users/command.js";
import { getUserHasUriagekin } from "../../services/users/query.js";

type Params = {
    userId: number;
    value: number;
    limit: number;
};

// POST /transfer/points
// summary: 売上金ポイント変換
// page: /transfer/points
export const createTransferPointsUseCase = async ({ userId, value, limit }: Params) => {
    // bodyバリデーション
    if (value === 0) throw new AppError("INVALID_VALUE_0", 400);
    if (value > limit) throw new AppError("INVALID_VALUE_OVER_LIMIT", 400);

    // user取得
    const user = await getUserHasUriagekin({ userId });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);

    // uriagekinHistory削除
    const oldUriagekin = user.uriagekin;
    const oldPoints = user.points;

    let deleteValue = value;

    // aとbを日時の数値に変換して引き算
    // → マイナスならaが前、プラスならbが前
    // → 結果として「古い順（昇順）」に並ぶ
    const lots = [...(user.UriagekinLots ?? [])].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    await sequelize.transaction(async (t) => {
        // UriagekinHistory古い順に削除
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

        await createJournal({
            data: {
                kanjyo_kari1: 3,
                kanjyo_kashi1: 8,
                reason_id: 7,
                price_kari1: value,
                price_kashi1: value,
            },
            transaction: t,
        });

        await createPointsHistory({
            data: {
                points: value,
                reason_id: 3,
                user_id: userId,
            },
            transaction: t,
        });

        await createPointLots({
            data: {
                points: value,
                user_id: userId,
                expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180日後
            },
            transaction: t,
        });

        await updatePointsUriageUser({
            user,
            data: {
                points: Number(oldPoints) + value,
                uriagekin: Number(oldUriagekin) - value,
            },
            transaction: t,
        });
    });

    createNotification({
        data: {
            read_user_id: userId,
            message: `売上金${value.toLocaleString()}円をポイントに変換しました。ポイントは当サイト内のお買い物にご利用いただけます。ポイントの有効期限は本日から180日後です。`,
            type: "TRANSFER",
        },
    }).catch((err) => {
        console.error("service createNotification error:", err);
    });
};
