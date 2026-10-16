import sequelize from "../../../db.js";
import { createItem } from "../../../services/items/index.js";
import { createShipping } from "../../../services/itemShippingProfile/itemShippingProfile.js";
import { createSale } from "../../../services/sale/sale.js";
import { createVideo } from "../../../services/video/video.js";

type Params = {
    userId: number;
};

// POST /items
// summary: 商品データ作成
// page: /upload/before
export const createItemsUseCase = async ({ userId }: Params) => {
    return await sequelize.transaction(async (t) => {
        const sale = await createSale({ transaction: t });
        const video = await createVideo({ transaction: t });
        const itemId = await createItem({ userId, saleId: sale.id, videoId: video.id, transaction: t });

        await createShipping({ itemId, transaction: t });

        return itemId;
    });
};
