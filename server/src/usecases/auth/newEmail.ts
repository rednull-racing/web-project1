import { AppError } from "../../errors.js";
import { updateShopEmail } from "../../services/shopInfo/command.js";
import { getTokenEmailChangeOne } from "../../services/tokenEmailChange/tokenEmailChange.js";
import { updateEmailUser } from "../../services/users/command.js";
import { getUserHasShop } from "../../services/users/query.js";

type Params = {
    token: string;
};

// PATCH /auth/new-email?token=""
// summary: メールアドレス更新
// page: /edit/email/new-email
export const changeNewEmailUseCase = async ({ token }: Params) => {
    // トークンDB取得
    const emailTokenData = await getTokenEmailChangeOne({ token });

    if (!emailTokenData) throw new AppError("TOKEN_DATA_NOT_FOUND", 404);
    if (emailTokenData.expires_at.getTime() < Date.now()) throw new AppError("EXPIRED_TOKEN", 401);

    // user取得
    const user = await getUserHasShop({ userId: emailTokenData.user_id });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);

    const newEmail = emailTokenData.new_email;

    // メールアドレスDB更新
    await updateEmailUser({
        user,
        data: {
            email: newEmail,
        },
    });

    if (user.ShopInfo) {
        await updateShopEmail({
            shopInfo: user.ShopInfo,
            data: {
                email: newEmail,
            },
        });
    }
};
