import sequelize from "../../db.js";
import { AppError } from "../../errors.js";
import { createAddressAllowNull } from "../../services/address/address.js";
import { getItemForBuy } from "../../services/items/index.js";
import { createNameAllowNull } from "../../services/name/name.js";
import { createPurchaseSession } from "../../services/purchaseSession/purchaseSession.js";
import { getUser, getUserHasAddress, getUserHasName } from "../../services/users/query.js";

type Params = {
    itemId: number;
    userId: number;
};

// POST /purchase-session/:id
// summary: 購入セッションデータ作成
// page: /item
export const postPurchaseSessionUseCase = async ({ itemId, userId }: Params) => {
    // 自ユーザー情報取得
    const user = await getUser({ userId });
    if (!user) {
        throw new AppError("USER_NOTFOUND", 404);
    }

    // Item取得
    const item = await getItemForBuy({ itemId });
    if (!item) {
        throw new AppError("ITEM_NOTFOUND", 404);
    }

    if (item.status !== "active") {
        throw new AppError("INVALID_ITEM", 400);
    }

    // 住所・氏名取得
    const userAddress = await getUserHasAddress({ userId });
    const address = userAddress?.Address;

    const userName = await getUserHasName({ userId });
    const name = userName?.Name;

    // データ作成
    const purchaseSessionId = await sequelize.transaction(async (t) => {
        const newAddress = await createAddressAllowNull({
            data: {
                post_number: address?.post_number ?? null,
                todouhuken_id: address?.todouhuken_id ?? null,
                shikutyouson: address?.shikutyouson ?? null,
                banchi: address?.banchi ?? null,
                building: address?.building ?? null,
            },
            transaction: t,
        });

        const newName = await createNameAllowNull({
            data: {
                sei: name?.sei ?? null,
                mei: name?.mei ?? null,
                sei_kana: name?.sei_kana ?? null,
                mei_kana: name?.mei_kana ?? null,
            },
            transaction: t,
        });

        const newPurchaseSession = await createPurchaseSession({
            data: {
                buyer_user_id: userId,
                buyer_phone_number: user.phone_number,
                item_id: itemId,
                address_id: newAddress.id,
                name_id: newName.id,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
            transaction: t,
        });

        return newPurchaseSession.id;
    });

    return purchaseSessionId;
};
