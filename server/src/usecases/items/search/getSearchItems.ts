import { InferAttributes, Op, Order, WhereOptions } from "sequelize";
import Item from "../../../models/item.js";
import { getSearchItems } from "../../../services/items/index.js";
import { createSearchKeyword } from "../../../services/search.js";
import { normalizeJapanese } from "../../../utils/normalizeJapanese.js";

type Params = {
    keyword: string;
    limit: number;
    sort: "popular" | "new" | "priceAsc" | "priceDesc";
    cursorScore?: number;
    cursorId?: number;
    userId?: number;
};

// GET /item/search?keyword=""&limit=number&sort=""(&cursorScore=number&cursorId=number)
// summary: キーワード検索
// page: /search?keyword=""
export const getSearchItemsUseCase = async ({ keyword, limit, sort, cursorScore, cursorId, userId }: Params) => {
    // 検索データ登録
    createSearchKeyword({
        data: {
            search_text: keyword,
            user_id: userId ?? null,
        },
    }).catch((err) => {
        console.log("service createSearchKeyword error:", err);
    });

    // 検索
    const normalizedKeyword = normalizeJapanese(keyword);

    const baseWhere = {
        sort_number: { [Op.gte]: 0 },
        status: ["active", "soldout"],
        search_text: { [Op.iLike]: `%${normalizedKeyword}%` },
        ...(userId ? { seller_id: { [Op.ne]: userId } } : {}),
    };

    const cursorWhere: WhereOptions<InferAttributes<Item>> =
        cursorScore !== undefined && cursorId !== undefined
            ? (() => {
                  if (sort === "popular") {
                      return {
                          [Op.or]: [
                              { sort_number: { [Op.lt]: cursorScore } },
                              {
                                  sort_number: cursorScore,
                                  id: { [Op.gt]: cursorId },
                              },
                          ],
                      };
                  } else if (sort === "new") {
                      return {
                          [Op.or]: [
                              { uploaded_at: { [Op.lt]: new Date(cursorScore) } },
                              {
                                  uploaded_at: new Date(cursorScore),
                                  id: { [Op.gt]: cursorId },
                              },
                          ],
                      };
                  } else if (sort === "priceAsc") {
                      return {
                          [Op.or]: [
                              { price: { [Op.gt]: cursorScore } },
                              {
                                  price: cursorScore,
                                  id: { [Op.gt]: cursorId },
                              },
                          ],
                      };
                  } else if (sort === "priceDesc") {
                      return {
                          [Op.or]: [
                              { price: { [Op.lt]: cursorScore } },
                              {
                                  price: cursorScore,
                                  id: { [Op.gt]: cursorId },
                              },
                          ],
                      };
                  }
                  return {};
              })()
            : {};

    const where: WhereOptions<InferAttributes<Item>> = {
        ...baseWhere,
        ...cursorWhere,
    };

    let order: Order = [];

    if (sort === "popular") {
        order = [
            ["sort_number", "DESC"],
            ["id", "ASC"],
        ];
    } else if (sort === "new") {
        order = [
            ["uploaded_at", "DESC"],
            ["id", "ASC"],
        ];
    } else if (sort === "priceAsc") {
        order = [
            ["price", "ASC"],
            ["sort_number", "DESC"],
            ["id", "ASC"],
        ];
    } else if (sort === "priceDesc") {
        order = [
            ["price", "DESC"],
            ["sort_number", "DESC"],
            ["id", "ASC"],
        ];
    }

    const items = await getSearchItems({ limit: limit + 1, where, order });

    const hasMore = items.length > limit;

    const slicedItems = hasMore ? items.slice(0, limit) : items;

    const lastItem = slicedItems[slicedItems.length - 1];

    const nextCursorScore = (() => {
        if (sort === "popular") return Number(lastItem.sort_number);
        if (sort === "new") return lastItem.uploaded_at?.getTime();
        if (sort === "priceAsc" || sort === "priceDesc") return lastItem.price;
        return undefined;
    })();

    const nextCursorId = lastItem?.id ?? null;

    return { itemList: slicedItems, nextCursorScore, nextCursorId, hasMore };
};
