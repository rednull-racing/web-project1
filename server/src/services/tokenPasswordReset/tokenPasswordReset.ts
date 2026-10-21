import { Op } from "sequelize";
import { TokenPasswordReset } from "../../models/index.js";
import type {
    CreateTokenParams,
    DeleteTokenParams,
    DestroyExpiredPasswordResetTokensParams,
    TokenParams,
} from "../../types/serviceType/tokenPasswordReset.js";

export const getTokenOne = ({ token }: TokenParams) => {
    return TokenPasswordReset.findOne({
        where: { token_hash: token },
    });
};

export const createTokenResetPW = async ({ data }: CreateTokenParams) => {
    await TokenPasswordReset.create(data);
};

export const deleteTokenRecord = async ({ resetRecord }: DeleteTokenParams) => {
    await resetRecord.destroy();
};

export const destroyExpiredPasswordResetTokens = ({ expiredBefore }: DestroyExpiredPasswordResetTokensParams) => {
    return TokenPasswordReset.destroy({
        where: { expires_at: { [Op.lt]: expiredBefore } },
    });
};
