import { destroyExpiredEmailChangeTokens } from "../../services/tokenEmailChange/tokenEmailChange.js";

// TokenEmailChange削除
export const deleteCronEmailChangeTokensUseCase = (): Promise<number> => {
    return destroyExpiredEmailChangeTokens({ expiredBefore: Date.now() });
};
