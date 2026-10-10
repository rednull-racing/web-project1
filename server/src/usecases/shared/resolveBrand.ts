import { Transaction } from "sequelize";
import { createAliases, getAliasOne } from "../../services/brandAliases.js";
import { getBrand, getBrandOne } from "../../services/brands.js";
import type { BrandResult } from "../../types/serviceType/brands.js";
import { normalizeJapanese } from "../../utils/normalizeJapanese.js";
import { ItemUploadSharedUseCaseBody } from "./bodyType.js";

type Params = {
    brandId: number | null;
    body: ItemUploadSharedUseCaseBody;
    transaction?: Transaction;
};

// ブランドチェック
export const resolveBrand = async ({ brandId, body, transaction }: Params): Promise<BrandResult> => {
    const brand = body.brand;

    if (brandId !== null) {
        const selectedBrand = await getBrand({ brandId });
        if (selectedBrand) return { brand: selectedBrand, alias: null };
    }

    if (!brand.name) return { brand: null, alias: null };

    const inputName = brand.name;
    const normalized = normalizeJapanese(inputName);
    const alias = await getAliasOne({ normalized });

    if (alias?.brand) return { brand: alias.brand, alias };

    const selectedBrand = await getBrandOne({ normalized });
    if (selectedBrand) return { brand: selectedBrand, alias: null };

    if (alias) return { brand: null, alias };

    if (inputName.length >= 2) {
        const createdAlias = await createAliases({ inputName, normalized, transaction });
        return { brand: null, alias: createdAlias };
    }

    return { brand: null, alias: null };
};
