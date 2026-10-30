import { makeDraft } from "../getItemDraftPage/fixtures.js";
export { deferred, waitForGate, invalidIds, acceptedSpellings } from "../getItemDraftPage/fixtures.js";

export const makeMetadata = (id = 101, name: string | null = "下書き") => ({ id, name });

// Model境界の単体用。余剰列の漏出を検出するため所有者等を含める。
export const makeMetadataRow = (id = 101, name: string | null = "下書き") =>
    Object.assign(makeDraft(id), { name });
