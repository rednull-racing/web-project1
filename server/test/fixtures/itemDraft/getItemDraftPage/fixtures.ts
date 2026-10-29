import { makeDraft as makePartialDraft } from "../deleteItemDraft/fixtures.js";
export { deferred, waitForGate, invalidIds, acceptedSpellings } from "../deleteItemDraft/fixtures.js";

// Modelメソッドを境界で置換する単体用。実DBでは独立したseedを使う。
export const makeDraft = (id = 101) => Object.assign(makePartialDraft(id), {
    id, seller_id: 7, name: "下書き", updatedAt: new Date("2026-10-29T00:00:00Z"),
    attributes: {}, Category: null, Brand: null,
});
