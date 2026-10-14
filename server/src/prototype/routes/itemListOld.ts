import { Router } from "express";
import type { NextFunction, Request, Response } from "express-serve-static-core";
import { Op } from "sequelize";
import { authenticateOptional, authenticateToken } from "../../middleware/index.js";
import { validateParams } from "../../middleware/validate/validateParams.js";
import { Item, Sale, Search, User, Video } from "../../models/index.js";
import { idParamSchema } from "../../validators/params/id.js";

const router = Router();

router.get(
    "/item-money-management/item-list/:id",
    validateParams(idParamSchema),
    authenticateToken,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const itemId = req.params.id;
            const currentUserId = req.user!.id;

            const itemList = await Item.findAll({
                attributes: ["id", "name", "price", "status", "uploaded_at", "first_image_url"],
                where: {
                    seller_id: currentUserId,
                    status: { [Op.in]: ["active", "soldout"] },
                    id: { [Op.ne]: itemId },
                },
                order: [["uploaded_at", "DESC"]],
                include: [
                    {
                        model: Sale,
                        attributes: ["discount_rate", "discount_amount", "sale_flag"],
                    },
                ],
            });

            res.json({ itemList });
        } catch (err) {
            next(err);
        }
    },
);

router.get(
    "/money-management/item-list",
    authenticateToken,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const currentUserId = req.user!.id;

            const itemList = await Item.findAll({
                attributes: ["id", "name", "price", "status", "uploaded_at", "first_image_url"],
                where: {
                    seller_id: currentUserId,
                    status: { [Op.in]: ["active", "soldout"] },
                },
                order: [["uploaded_at", "DESC"]],
                include: [
                    {
                        model: Sale,
                        attributes: ["discount_rate", "discount_amount", "sale_flag"],
                    },
                ],
            });

            res.json({ itemList });
        } catch (err) {
            next(err);
        }
    },
);

router.get(
    "/search2/video-list",
    authenticateOptional,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const currentUserId = req.user?.id ?? null;

            const page = parseInt(req.query.page as string) || 1;
            const limit = 12;
            const offset = (page - 1) * limit;

            const searchId = req.query.search_id;

            if (!searchId) {
                res.status(400).json({ message: "search_idが指定されていません。" });
                return;
            }

            const search = await Search.findOne({
                where: { id: searchId },
            });

            if (!search) {
                res.status(404).json({ message: "検索情報が見つかりません。" });
                return;
            }

            const categoryText = search.category_text;
            let categoryCondition = {};

            const parts = categoryText.split(" - ").map((p: string) => p?.trim());

            if (parts.length === 1) {
                categoryCondition = {
                    category_text: { [Op.iLike]: `%${parts[0]}%` },
                };
            } else {
                categoryCondition = { category_text: categoryText };
            }

            const itemList = await Item.findAll({
                attributes: ["id", "name", "price", "status", "sort_number"],
                where: {
                    seller_id: { [Op.ne]: currentUserId },
                    status: { [Op.in]: ["active", "soldout"] },
                    ...categoryCondition,
                },
                order: [["sort_number", "DESC"]],
                limit,
                offset,
                include: [
                    {
                        model: Video,
                        attributes: ["thumbnail_url", "duration", "title"],
                    },
                    {
                        model: Sale,
                        attributes: ["sale_flag", "before_price", "discount_rate", "discount_amount"],
                    },
                    {
                        model: User,
                        attributes: ["user_name", "profile_image"],
                    },
                ],
            });

            res.json({ itemList });
        } catch (err) {
            next(err);
        }
    },
);

router.get(
    "/search2/item-list",
    authenticateOptional,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const currentUserId = req.user?.id ?? null;

            const page = parseInt(req.query.page as string) || 1;
            const limit = Number(req.query.limit) || 18;
            const offset = (page - 1) * limit;

            const searchId = req.query.search_id;

            if (!searchId) {
                res.status(400).json({ message: "search_idが指定されていません 。" });
                return;
            }

            const search = await Search.findOne({
                where: { id: searchId },
            });

            if (!search) {
                res.status(404).json({ message: "検索情報が見つかりません。" });
                return;
            }

            const categoryText = search.category_text;
            let categoryCondition = {};

            const parts = categoryText.split(" - ").map((p: string) => p?.trim());

            if (parts.length === 1) {
                categoryCondition = {
                    category_text: { [Op.iLike]: `%${parts[0]}%` },
                };
            } else {
                categoryCondition = { category_text: categoryText };
            }

            const itemList = await Item.findAll({
                attributes: ["id", "name", "price", "status", "sort_number", "first_image_url"],
                where: {
                    seller_id: { [Op.ne]: currentUserId },
                    status: { [Op.in]: ["active", "soldout"] },
                    ...categoryCondition,
                },
                order: [["sort_number", "DESC"]],
                limit,
                offset,
                include: [
                    {
                        model: Sale,
                        attributes: ["sale_flag", "discount_rate", "discount_amount"],
                    },
                ],
            });

            res.json({ itemList });
        } catch (err) {
            next(err);
        }
    },
);

export default router;
