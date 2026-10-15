import { Transaction } from "sequelize";
import { ItemDeleted } from "../models/index.js";

type CreateItemDeletedParams = {
    data: {
        item_id: number;
        seller_id: number;
        item_name: string;
        detail: string;
        price: number;
        image_url: string[];
        video_url: string | null;
        thumbnail_url: string | null;
        video_title: string | null;
        video_summary: string | null;
        delete_reason: string;
        deleted_by: number;
    };
    transaction?: Transaction;
};

type BulkCreateItemDeletedParams = {
    data: {
        item_id: number;
        seller_id: number;
        item_name: string;
        detail: string;
        price: number;
        image_url: string[];
        video_url: string | null;
        thumbnail_url: string | null;
        video_title: string | null;
        video_summary: string | null;
        delete_reason: string;
        deleted_by: number;
    }[];
    transaction?: Transaction;
};

export const createItemDeleted = async ({ data, transaction }: CreateItemDeletedParams) => {
    await ItemDeleted.create(data, { transaction });
};

export const bulkCreateItemDeleted = async ({ data, transaction }: BulkCreateItemDeletedParams) => {
    await ItemDeleted.bulkCreate(data, { transaction });
};
