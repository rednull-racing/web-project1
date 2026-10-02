import { AppError } from "../../../errors.js";
import { updateShopOther } from "../../../services/shopInfo/command.js";
import { getMyShop } from "../../../services/shopInfo/query.js";
import { ShopOtherBody } from "../../../validators/body/shopInfo.js";

type Params = {
    shopId: number;
    userId: number;
    body: ShopOtherBody;
};

// PATCH /shop-info/:id/other
// summary: その他ショップ情報更新
// page: /edit/shop/other/[id]
export const editShopOtherUseCase = async ({ shopId, userId, body }: Params) => {
    // shopInfo取得
    const shop = await getMyShop({ shopId, userId });

    if (!shop) throw new AppError("SHOP_NOT_FOUND", 404);

    // db更新
    await updateShopOther({
        shopInfo: shop,
        data: {
            shop_name: body.shopName,
            open_date_time: body.openDateTime ?? null,
            founded_date: body.foundedDate,
            member_count: body.memberCount,
            homepage_url: body.homepage ?? null,
            company_number: body.companyNumber ?? null,
            capital: body.capital ?? null,
        },
    });
};
