import { getAllAliases } from "../../services/brandAliases.js";
import { BrandsInstance, getAllBrands } from "../../services/brands.js";

type Params = {
    keyword: string;
};

// GET /brands/suggest?keyword=""
// summary: ブランドサジェスト検索リスト取得
// page: /upload
export const getBrandsSuggestUseCase = async ({ keyword }: Params) => {
    // Brands取得
    const direct = await getAllBrands({ keyword });

    const directLength = direct.length;

    // BrandAliases取得
    let fromAlias = null;

    if (directLength < 15) {
        fromAlias = await getAllAliases({ keyword, directLength });
    }

    const brandMap = new Map<number, BrandsInstance>();

    for (const d of direct) {
        brandMap.set(d.id, d);
    }

    if (fromAlias) {
        for (const alias of fromAlias) {
            if (alias.brand) {
                brandMap.set(alias.brand.id, alias.brand);
            }
        }
    }

    const brands = Array.from(brandMap.values());

    return brands;
};
