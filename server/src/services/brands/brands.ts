import { Op } from "sequelize";
import { Brands } from "../../models/index.js";
import { BrandIdParams, GetAllBrandsParams, NormalizedParams } from "../../types/serviceType/brands.js";
import sequelize from "../../db.js";

export type BrandsInstance = InstanceType<typeof Brands>;

export const getBrand = ({ brandId }: BrandIdParams) => {
    return Brands.findByPk(brandId);
};

export const getBrandOne = ({ normalized }: NormalizedParams) => {
    return Brands.findOne({
        where: { name_normalized: normalized },
    });
};

export const getAllBrands = ({ keyword }: GetAllBrandsParams) => {
    return Brands.findAll({
        where: {
            name: {
                [Op.iLike]: `%${keyword}%`,
            },
        },
        order: [[sequelize.fn("length", sequelize.col("Brands.name")), "ASC"]],
        limit: 15,
    }) as unknown as BrandsInstance[];
};
