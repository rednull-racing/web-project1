import { Op } from "sequelize";
import { TokenEmailChange } from "../../models/index.js";
import type {
    CreateTokenEmailChangeParams,
    DestroyExpiredEmailChangeTokensParams,
    TokenEmailChangeParams,
} from "../../types/serviceType/tokenEmailChange.js";

export const getTokenEmailChangeOne = ({ token }: TokenEmailChangeParams) => {
    return TokenEmailChange.findOne({
        where: {
            token_hash: token,
            expires_at: { [Op.gt]: new Date() },
        },
    });
};

export const createTokenEmailChange = async ({ data }: CreateTokenEmailChangeParams) => {
    await TokenEmailChange.create(data);
};

export const destroyExpiredEmailChangeTokens = ({ expiredBefore }: DestroyExpiredEmailChangeTokensParams) => {
    return TokenEmailChange.destroy({
        where: { expires_at: { [Op.lt]: expiredBefore } },
    });
};
