import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { createAddress } from "../../../services/address/address.js";
import { createNotification } from "../../../services/notification/notification.js";
import { getMyShop } from "../../../services/shopInfo/query.js";
import { createShopEdit } from "../../../services/shopInfoEdit/command.js";
import { AddressBody } from "../../../validators/body/address.js";
import { fetchAddressFromZipUseCase } from "../../address/zipUseCase.js";

type Params = {
    shopId: number;
    userId: number;
    body: AddressBody;
};

// POST /shop-info-edit/:id/address
// summary: 会社所在地変更リクエスト
// page: /edit/address/shop/[id]
export const createAddressShopEditUseCase = async ({ shopId, userId, body }: Params) => {
    // body
    const { postNumber, todouhuken, shikutyouson, banchi, building } = body;

    // shopInfo取得
    const shop = await getMyShop({ shopId, userId });

    if (!shop) throw new AppError("SHOP_NOT_FOUND", 404);

    // 住所バリデーションチェック
    const fromZip = await fetchAddressFromZipUseCase({ zipcode: postNumber });

    if (!fromZip) throw new AppError("INVALID_POSTNUMBER", 400);
    if (fromZip.todouhuken_name !== todouhuken) {
        throw new AppError("NOT_SAME_POSTNUMBER_TODOUHUKEN", 400);
    }
    if (fromZip.shikutyouson !== shikutyouson) {
        throw new AppError("NOT_SAME_POSTNUMBER_SHIKUTYOUSON", 400);
    }

    // db登録
    await sequelize.transaction(async (t) => {
        const newAddress = await createAddress({
            data: {
                post_number: postNumber,
                todouhuken_id: fromZip.todouhuken_id,
                shikutyouson: shikutyouson,
                banchi: banchi,
                building: building,
            },
            transaction: t,
        });

        await createShopEdit({
            data: {
                user_id: userId,
                shop_info_id: shopId,
                address_id: newAddress.id,
            },
            transaction: t,
        });
    });

    // お知らせ作成
    createNotification({
        data: {
            read_user_id: userId,
            message:
                "会社所在地の変更を受け付けました。審査には1~2週間程度お時間を要する場合がございます。審査完了までしばらくお待ちください。",
            type: "SHOP_EDIT",
        },
    }).catch((err) => {
        console.error("service createNotification error:", err);
    });
};
