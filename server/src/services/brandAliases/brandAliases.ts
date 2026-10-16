import { Op } from "sequelize";
import sequelize from "../../db.js";
import { BrandAliases, Brands } from "../../models/index.js";
import { GetAllAliasesParams, NameNormalizedParams, NormalizedParams } from "../../types/serviceType/brandAliases.js";

export const getAliasOne = ({ normalized }: NormalizedParams) => {
    return BrandAliases.findOne({
        where: { name_normalized: normalized },
        include: [
            {
                model: Brands,
                as: "brand",
            },
        ],
    });
};

export const getAllAliases = ({ keyword, directLength }: GetAllAliasesParams) => {
    return BrandAliases.findAll({
        where: {
            [Op.or]: [
                {
                    name: {
                        [Op.iLike]: `%${keyword}%`,
                    },
                },
                {
                    name_normalized: {
                        [Op.iLike]: `%${keyword}%`,
                    },
                },
            ],
        },
        include: [
            {
                model: Brands,
                as: "brand",
                required: true,
            },
        ],
        order: [[sequelize.fn("length", sequelize.col("BrandAliases.name")), "ASC"]],
        limit: 15 - directLength,
    });
};

export const createAliases = async ({ inputName, normalized, transaction }: NameNormalizedParams) => {
    if (transaction) {
        // 未登録名には行ロックを取れないため、正規化名ごとのtransactionロックで作成を直列化する。
        await sequelize.query("SELECT pg_advisory_xact_lock(hashtext('brand_aliases'), hashtext($normalized))", {
            bind: { normalized },
            transaction,
        });

        const existingAlias = await BrandAliases.findOne({
            where: { name_normalized: normalized },
            include: [{ model: Brands, as: "brand" }],
            transaction,
        });
        if (existingAlias) return existingAlias;
    }

    return BrandAliases.create(
        {
            brand_id: null,
            name: inputName,
            name_normalized: normalized,
        },
        { transaction },
    );
};
