import { Router } from "express";
import type { NextFunction, Request, Response } from "express-serve-static-core";
import { Op } from "sequelize";
import { authenticateToken } from "../../middleware/index.js";
import { validateParams } from "../../middleware/validate/validateParams.js";
import {
    Address,
    Cancel,
    Categories,
    Chat,
    Delivery,
    DeliveryStatusOption,
    Item,
    Name,
    Orders,
    PaymentMethodOption,
    Sale,
    ShippingDayOption,
    ShippingServiceOption,
    ShopInfo,
    TodouhukenOption,
    User,
} from "../../models/index.js";
import { idParamSchema } from "../../validators/params/id.js";

const router = Router();

router.get(
    "/buy/:id",
    validateParams(idParamSchema),
    authenticateToken,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = await Orders.findByPk(req.params.id, {
                attributes: ["id", "price", "total_amount", "item_count", "purchase_snapshot"],
                include: [
                    {
                        model: Item,
                        attributes: ["id", "name", "first_image_url"],
                    },
                    {
                        model: Delivery,
                        attributes: ["id", "buyer_phone_number", "arrive_specified_date"],
                        include: [
                            { model: ShippingDayOption },
                            { model: ShippingServiceOption },
                            {
                                model: TodouhukenOption,
                                as: "DeliveryTodouhuken",
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
                            {
                                model: Name,
                                attributes: ["sei", "mei"],
                            },
                        ],
                    },
                    {
                        model: User,
                        as: "Seller",
                        attributes: ["id", "user_name"],
                    },
                    {
                        model: User,
                        as: "Buyer",
                        attributes: ["id", "points"],
                    },
                ],
            });

            if (!data) {
                res.status(404).json({ message: "データを取得できません。" });
                return;
            }

            res.json({ data });
        } catch (err) {
            next(err);
        }
    },
);

router.get(
    "/buy-item-after/:id",
    validateParams(idParamSchema),
    authenticateToken,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = await Orders.findByPk(req.params.id, {
                attributes: [
                    "id",
                    "unit_price",
                    "subtotal_amount",
                    "discount_amount",
                    "total_amount",
                    "points_used",
                    "paid_amount",
                    "item_count",
                    "buy_at",
                    "paid_at",
                    "status",
                    "order_id",
                    "purchase_snapshot",
                ],
                include: [
                    {
                        model: PaymentMethodOption,
                        required: false,
                    },
                    {
                        model: Chat,
                        required: false,
                        attributes: [
                            "seller_username",
                            "seller_chat",
                            "buyer_username",
                            "buyer_chat",
                            "createdAt",
                            "updatedAt",
                        ],
                    },
                    {
                        model: Item,
                        attributes: ["id", "name", "first_image_url"],
                        include: [
                            {
                                model: Categories,
                                as: "Category",
                                required: false,
                                include: [
                                    {
                                        model: Categories,
                                        as: "parent",
                                        required: false,
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        model: User,
                        as: "Seller",
                        attributes: ["id", "user_name", "profile_image", "verified", "star_amount", "star_average"],
                        include: [
                            {
                                model: ShopInfo,
                                attributes: ["id"],
                                required: false,
                            },
                        ],
                    },
                    {
                        model: Delivery,
                        attributes: ["id", "buyer_phone_number", "shipping_at", "arrived_at", "arrive_specified_date"],
                        include: [
                            { model: ShippingDayOption },
                            { model: DeliveryStatusOption },
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
                            {
                                model: Name,
                                attributes: ["sei", "mei"],
                            },
                        ],
                    },
                    {
                        model: Cancel,
                        required: false,
                        attributes: ["id", "cancel_flag"],
                    },
                ],
            });

            if (!data) {
                res.status(404).json({ message: "データを取得できません。" });
                return;
            }

            const item = data.Item;
            const itemId = item?.id ?? null;
            const currentUserId = req.user?.id ?? null;

            const baseCategory = item.Category;

            const targetParentId = baseCategory.parent_id ?? baseCategory.id;

            const itemList = await Item.findAll({
                attributes: ["id", "name", "price", "first_image_url"],
                where: {
                    status: "active",
                    id: { [Op.ne]: itemId },
                    seller_id: { [Op.ne]: currentUserId },
                },
                order: [["sort_number", "DESC"]],
                limit: 20,
                include: [
                    {
                        model: Sale,
                        attributes: ["discount_rate", "discount_amount", "sale_flag"],
                    },
                    {
                        model: Categories,
                        as: "Category",
                        where: {
                            [Op.or]: [{ parent_id: targetParentId }, { id: targetParentId }],
                        },
                        attributes: ["id"],
                        required: true,
                    },
                ],
            });

            res.json({ data, itemList });
        } catch (err) {
            next(err);
        }
    },
);

router.get(
    "/cancel-page/:id",
    validateParams(idParamSchema),
    authenticateToken,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = await Orders.findByPk(req.params.id, {
                attributes: ["id", "total_amount", "item_count"],
                include: [
                    {
                        model: Item,
                        attributes: ["id", "name", "first_image_url"],
                    },
                    {
                        model: User,
                        as: "Seller",
                        attributes: ["id", "user_name", "profile_image", "verified"],
                        include: [
                            {
                                model: ShopInfo,
                                attributes: ["id"],
                            },
                        ],
                    },
                ],
            });

            if (!data) {
                res.status(404).json({ message: "データを取得できません。" });
                return;
            }

            res.json({ data });
        } catch (err) {
            next(err);
        }
    },
);

router.get(
    "/item-transport/:id",
    validateParams(idParamSchema),
    authenticateToken,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = await Orders.findByPk(req.params.id, {
                attributes: [
                    "id",
                    "unit_price",
                    "subtotal_amount",
                    "discount_amount",
                    "total_amount",
                    "item_count",
                    "buy_at",
                    "paid_at",
                    "status",
                    "order_id",
                    "sales_commission_amount",
                    "gain_amount",
                    "purchase_snapshot",
                ],
                include: [
                    {
                        model: Chat,
                        required: false,
                        attributes: [
                            "seller_username",
                            "seller_chat",
                            "buyer_username",
                            "buyer_chat",
                            "createdAt",
                            "updatedAt",
                        ],
                    },
                    {
                        model: Item,
                        attributes: ["id", "name", "first_image_url"],
                    },
                    {
                        model: User,
                        as: "Buyer",
                        attributes: ["id", "user_name", "profile_image", "verified"],
                        include: [
                            {
                                model: ShopInfo,
                                attributes: ["id"],
                                required: false,
                            },
                        ],
                    },
                    {
                        model: Delivery,
                        attributes: ["id", "buyer_phone_number", "shipping_at", "arrived_at", "arrive_specified_date"],
                        include: [
                            { model: ShippingDayOption },
                            { model: DeliveryStatusOption },
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
                            {
                                model: Name,
                                attributes: ["sei", "mei"],
                            },
                        ],
                    },
                    {
                        model: Cancel,
                        required: false,
                        attributes: ["id", "cancel_flag", "cancel_reason", "item_count"],
                    },
                ],
            });

            if (!data) {
                res.status(404).json({ message: "データを取得できません。" });
                return;
            }

            res.json({ data });
        } catch (err) {
            next(err);
        }
    },
);

export default router;
