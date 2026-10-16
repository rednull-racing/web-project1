import sequelize from "../../../db.js";
import {
    destroySignupVerificationTokens,
    getExpiredSignupVerificationTokens,
} from "../../../services/tokenSignupVerificationCode/tokenSignupVerificationCode.js";
import { destroyUnverifiedUsers } from "../../../services/users/command.js";

type ExpiredSignupVerificationToken = {
    user_id: number;
};

// 未認証ユーザー削除
export const deleteCronUnverifiedUsersUseCase = async (): Promise<number> => {
    const expiredTokens: ExpiredSignupVerificationToken[] = await getExpiredSignupVerificationTokens({
        expiredBefore: Date.now(),
    });

    if (expiredTokens.length === 0) return 0;

    const expiredUserIds = expiredTokens.map((token) => token.user_id);

    await sequelize.transaction(async (transaction) => {
        await destroyUnverifiedUsers({ userIds: expiredUserIds, transaction });
        await destroySignupVerificationTokens({ userIds: expiredUserIds, transaction });
    });

    return expiredUserIds.length;
};
