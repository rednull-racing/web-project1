import { Sale } from "../models/index.js";
import {
    CreateSaleParams,
    LogicalDeleteUpdateParams,
    SaleIdParams,
    UpdateSaleEditParams,
    UpdateSaleParams,
} from "../types/serviceType/sale.js";

export const getSale = ({ saleId }: SaleIdParams) => {
    return Sale.findByPk(saleId);
};

export const createSale = async ({ itemId, transaction }: CreateSaleParams) => {
    await Sale.create(
        {
            item_id: itemId,
        },
        { transaction },
    );
};

export const updateLogicalDelete = async ({ sale, transaction }: LogicalDeleteUpdateParams) => {
    await sale.update(
        {
            discount_rate: 0,
            discount_amount: 0,
            sale_flag: false,
        },
        { transaction },
    );
};

export const updateSale = async ({ sale, data, transaction }: UpdateSaleParams) => {
    await sale.update(
        {
            sale_flag: false,
            discount_rate: 0,
            discount_amount: 0,
            ...data,
        },
        { transaction },
    );
};

export const updateSaleEdit = async ({ sale, data, transaction }: UpdateSaleEditParams) => {
    await sale.update(data, { transaction });
};
