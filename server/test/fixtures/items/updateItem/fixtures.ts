import type { getMyItemForUpdate } from "../../../../src/services/items/query/relation.js";
import { makeEditing as makePublishEditing } from "../createItem/fixtures.js";
export { deferred, freezeDeep, expectedAttributes, idFields, requiredIdFields } from "../createItem/fixtures.js";

export const makeEditing = () => {
    const editing = makePublishEditing();
    editing.status = "edit";
    editing.item_id = 456;
    return editing;
};

export const makeTarget = () => ({
    item: { id: 456, seller_id: 7, status: "soldout", video_id: 101, sale_id: 202, shipping_id: 303 },
    video: { id: 101 },
    sale: { id: 202 },
    shipping: { id: 303 },
}) as NonNullable<Awaited<ReturnType<typeof getMyItemForUpdate>>>;
