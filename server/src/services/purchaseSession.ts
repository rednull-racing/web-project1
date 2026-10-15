import { Op } from "sequelize";
import { Address, Name, PurchaseSession, TodouhukenOption } from "../models/index.js";
import type {
    CreatePurchaseSessionParams,
    CronDeleteParams,
    PurchaseSessionUserIdParams,
} from "../types/serviceType/purchaseSession.js";

export const getMyPurchaseSessionHasAddress = ({ purchaseSessionId, userId }: PurchaseSessionUserIdParams) => {
    return PurchaseSession.findOne({
        where: {
            id: purchaseSessionId,
            buyer_user_id: userId,
        },
        include: [
            {
                model: Address,
                attributes: ["id", "post_number", "shikutyouson", "banchi", "building"],
                include: [
                    {
                        model: TodouhukenOption,
                        as: "AddressTodouhuken",
                    },
                ],
            },
        ],
    });
};

export const getMyPurchaseSessionHasName = ({ purchaseSessionId, userId }: PurchaseSessionUserIdParams) => {
    return PurchaseSession.findOne({
        where: {
            id: purchaseSessionId,
            buyer_user_id: userId,
        },
        include: [
            {
                model: Name,
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
            },
        ],
    });
};

export const createPurchaseSession = ({ data, transaction }: CreatePurchaseSessionParams) => {
    return PurchaseSession.create(data, { transaction });
};

export const deleteCron = async ({ now, transaction }: CronDeleteParams) => {
    return PurchaseSession.destroy({
        where: {
            expires_at: { [Op.lt]: now },
        },
        transaction,
    });
};
