import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { createJournal } from "../../../services/journal/journal.js";
import { createNotification } from "../../../services/notification/notification.js";
import { updateUsedUriagekin } from "../../../services/uriagekinLots/uriagekinLots.js";
import { updateUriageUser } from "../../../services/users/command.js";
import { getUserHasUriagekin } from "../../../services/users/query.js";

type Params = {
    pageUserId: number;
    deleteUriage: number;
};

// PATCH /admin/user/:id/delete-uriage
// summary: 売上金没収
// page: /profile/admin/[id]
export const deleteUriageUseCase = async ({ pageUserId, deleteUriage }: Params) => {
    // bodyバリデーション
    if (deleteUriage <= 0) throw new AppError("INVALID_BODY", 400);

    // user取得
    const user = await getUserHasUriagekin({ userId: pageUserId });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);
    if (Number(user.uriagekin) < deleteUriage) {
        throw new AppError("INVALID_BODY_OVER_URIAGEKIN", 400);
    }

    // uriagekinHistory削除
    const oldUriagekin = Number(user.uriagekin);

    let deleteValue = deleteUriage;

    // aとbを日時の数値に変換して引き算
    // → マイナスならaが前、プラスならbが前
    // → 結果として「古い順（昇順）」に並ぶ
    const lots = [
        ...((
            user as unknown as {
                UriagekinLots?: Array<Parameters<typeof updateUsedUriagekin>[0]["lots"]>;
            }
        ).UriagekinLots ?? []),
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    await sequelize.transaction(async (t) => {
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
                uriagekin: oldUriagekin - deleteUriage,
            },
            transaction: t,
        });

        await createJournal({
            data: {
                kanjyo_kari1: 3,
                kanjyo_kashi1: 6,
                price_kari1: deleteUriage,
                price_kashi1: deleteUriage,
                reason_id: 8,
            },
            transaction: t,
        });
    });

    // メール送信処理

    createNotification({
        data: {
            read_user_id: pageUserId,
            message: `重大な規約違反が確認されたため、売上金${deleteUriage.toLocaleString()}円を回収いたしました。利用規約に沿ったご利用をお願いします。`,
            type: "URIAGE_DELETED_BY_ADMIN",
        },
    }).catch((err) => {
        console.error("service createNotification error:", err);
    });
};
