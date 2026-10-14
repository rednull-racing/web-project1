import { createUriage180 } from "../../services/pointsUriageOver.js";
import { createTransfer } from "../../services/transfer.js";
import { getExpiredUriageAll } from "../../services/uriagekinLots.js";
import { getUserHasBankAccount } from "../../services/users/query.js";
import type { UriagekinLotsInstance } from "../../types/serviceType/uriagekinLots.js";
import { generateTransferId } from "../../utils/generateTransferId.js";

// 180日経過売上金回収
export const cronExpiredUriagekinUseCase = async () => {
    const nowDate = new Date();
    const twoWeeksLater = new Date(nowDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    const allExpiredData = await getExpiredUriageAll({ expiredBefore: nowDate });

    const groupedByUserId = allExpiredData.reduce<Record<number, UriagekinLotsInstance[]>>((acc, data) => {
        if (!acc[data.user_id]) {
            acc[data.user_id] = [];
        }
        acc[data.user_id].push(data);
        return acc;
    }, {});

    let sumGetUriagekin = 0;
    let sumTransUriagekin = 0;
    const failedUserIds: number[] = [];
    const missingUserIds: number[] = [];

    for (const [userIdText, userDataList] of Object.entries(groupedByUserId)) {
        const userId = Number(userIdText);

        try {
            const sumRemainingUriagekin = userDataList.reduce(
                (sum, data) => sum + (data.uriagekin - data.used_uriagekin),
                0,
            );
            const user = await getUserHasBankAccount({ userId });

            if (!user) {
                missingUserIds.push(userId);
                continue;
            }

            if (user.BankAccount) {
                const account = user.BankAccount;
                const transferId = await generateTransferId();

                await createTransfer({
                    data: {
                        request_money: sumRemainingUriagekin,
                        handling_charge: 200,
                        trans_money: sumRemainingUriagekin,
                        trans_reason_id: 3,
                        user_id: userId,
                        trans_schedule_date: twoWeeksLater,
                        transfer_id: transferId,
                        bank_snapshot: {
                            bank_name: String(account?.bank_name),
                            branch_name: String(account?.branch),
                            account_type: account?.account_type ?? "ordinary",
                            account_number: String(account?.account_number),
                            meigi: String(account?.meigi),
                        },
                    },
                });

                sumTransUriagekin += sumRemainingUriagekin;
                continue;
            }

            await createUriage180({
                data: {
                    uriagekin_180: sumRemainingUriagekin,
                },
            });

            sumGetUriagekin += sumRemainingUriagekin;
        } catch {
            failedUserIds.push(userId);
        }
    }

    return {
        expiredCount: allExpiredData.length,
        failedUserIds,
        missingUserIds,
        sumGetUriagekin,
        sumTransUriagekin,
    };
};
