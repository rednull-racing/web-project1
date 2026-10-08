import { createAliases, getAliasOne } from "../../../services/brandAliases.js";
import { getBrand, getBrandOne } from "../../../services/brands.js";
import { BrandResult } from "../../../types/serviceType/brands.js";
import { normalizeJapanese } from "../../../utils/normalizeJapanese.js";
import { ItemEditingConfirmBody } from "../../../validators/body/itemEditing.js";

type Params = {
    brandId: number | null;
    body: ItemEditingConfirmBody;
};

// ブランドチェック
export const resolveBrand = async ({ brandId, body }: Params) => {
    const brand = body.brand;

    let brandResult: BrandResult = { brand: null, alias: null };

    if (brandId !== null) {
        const selectedBrand = await getBrand({ brandId });
        brandResult = { brand: selectedBrand, alias: null };
    }

    if (!brandResult.brand && brand.name) {
        const inputName = brand.name;
        const normalized = normalizeJapanese(inputName);

        let alias = await getAliasOne({ normalized });

        if (alias?.brand) {
            brandResult = { brand: alias.brand, alias };
        }

        const brandsData = await getBrandOne({ normalized });

        if (!brandsData && inputName.length >= 2) {
            alias = await createAliases({ inputName, normalized });
        }
    }

    return brandResult;
};
