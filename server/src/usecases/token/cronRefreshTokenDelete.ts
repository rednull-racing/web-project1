import { destroyExpiredRefreshTokens } from "../../services/refreshTokens/refreshTokens.js";

// 期限切れRefreshTokens削除
export const deleteCronRefreshTokensUseCase = (): Promise<number> => {
    return destroyExpiredRefreshTokens({ expiredBefore: Date.now() });
};
