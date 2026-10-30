import { makeConfirmRow } from "../../../../src/usecases/itemEditing/test/getItemConfirmPage.fixtures.js";
export { deferred } from "../../../../src/usecases/itemEditing/test/getItemConfirmPage.fixtures.js";
export { waitForGate, invalidIds, acceptedSpellings } from "../../itemDraft/getItemDraftPage/fixtures.js";

export const makeMetadata = (id = 101, name: string | null = "編集セッション") => ({ id, name });

// Model境界の単体用。余剰列の漏出を検出するため所有者等を含める。
export const makeMetadataRow = (id = 101, name: string | null = "編集セッション") =>
    Object.assign(makeConfirmRow(id), { name });
