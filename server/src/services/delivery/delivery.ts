import { Op } from "sequelize";
import { Address, Delivery, Name, Orders, TodouhukenOption } from "../../models/index.js";
import { DeliveryUserIdParams, ItemIdParams, UpdateDeliveryCancelParams } from "../../types/serviceType/delivery.js";

export const getMyDeliveryHasAddress = ({ deliveryId, userId }: DeliveryUserIdParams) => {
    return Delivery.findOne({
        where: {
            id: deliveryId,
        },
        include: [
            {
                model: Orders,
                where: {
                    user_id: userId,
                },
                attributes: [],
                required: true,
            },
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

export const getMyDeliveryHasName = ({ deliveryId, userId }: DeliveryUserIdParams) => {
    return Delivery.findOne({
        where: {
            id: deliveryId,
        },
        include: [
            {
                model: Orders,
                where: {
                    user_id: userId,
                },
                attributes: [],
                required: true,
            },
            {
                model: Name,
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
            },
        ],
    });
};

export const findDeliveryNow = async ({ itemId }: ItemIdParams) => {
    return Delivery.findAll({
        where: {
            cancel: false,
            delivery_status_id: { [Op.ne]: 4 },
            orders_id: { [Op.not]: null },
        },
        include: [
            {
                model: Orders,
                required: true,
                where: { item_id: itemId },
            },
        ],
    });
};

export const updateDeliveryCancel = async ({ delivery, data, transaction }: UpdateDeliveryCancelParams) => {
    await delivery.update(data, { transaction });
};
