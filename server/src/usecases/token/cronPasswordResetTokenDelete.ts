import { destroyExpiredPasswordResetTokens } from "../../services/tokenPasswordReset/tokenPasswordReset.js";

// TokenPasswordReset削除
export const deleteCronPasswordResetTokensUseCase = (): Promise<number> => {
    return destroyExpiredPasswordResetTokens({ expiredBefore: Date.now() });
};
