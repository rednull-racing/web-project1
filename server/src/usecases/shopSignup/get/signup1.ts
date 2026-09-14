import { AppError } from "../../../errors.js";
import { getComFreeOptionAll } from "../../../services/comOrFreeOption.js";
import { getShopSignup1One, getUserShopSignup1 } from "../../../services/shopSignup.js";

type Props = {
    userId: number;
};

// GET /shop-signup/1
// summary: 事業者情報登録ページ インプット表示データ取得
// page: /shop-signup/step1
export const getShopSignup1UseCase = async ({ userId }: Props) => {
    // shopSignup取得（無くても可）
    const shopSignup = await getShopSignup1One({ userId });

    if (shopSignup.user_id && shopSignup.user_id !== userId) {
        throw new AppError("FORBIDDEN", 403);
    }

    // user取得
    const user = await getUserShopSignup1({ userId });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);

    // comOrFree取得
    const comFree = await getComFreeOptionAll();

    return { shopSignup, user, comFree };
};
