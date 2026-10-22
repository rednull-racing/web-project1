import { vi } from "vitest";

const videoHttpMocks = vi.hoisted(() => ({ convert: vi.fn(), create: vi.fn() }));
export { videoHttpMocks };

vi.mock("../../../../src/usecases/itemDraft/convertItemDraftVideo.js", () => ({
    convertItemDraftVideoUseCase: videoHttpMocks.convert,
}));
vi.mock("../../../../src/usecases/itemDraft/createItemDraft.js", () => ({
    createItemDraftUseCase: videoHttpMocks.create,
}));
vi.mock("../../../../src/usecases/itemDraft/deleteItemDraft.js", () => ({
    deleteItemDraftUseCase: vi.fn(),
}));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
