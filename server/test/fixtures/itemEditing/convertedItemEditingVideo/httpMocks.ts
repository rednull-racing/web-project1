import { vi } from "vitest";

const videoHttpMocks = vi.hoisted(() => ({ convert: vi.fn(), create: vi.fn() }));
export { videoHttpMocks };

vi.mock("../../../../src/usecases/itemEditing/convertedItemEditingVideo.js", () => ({
    convertedItemEditingVideoUseCase: videoHttpMocks.convert,
}));
vi.mock("../../../../src/usecases/itemEditing/createItemEditing.js", () => ({
    createItemEditingUseCase: videoHttpMocks.create,
}));
vi.mock("../../../../src/usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.js", () => ({
    createItemEditingCopyUseCase: vi.fn(),
}));
vi.mock("../../../../src/usecases/itemEditing/createItemEditingDraft.js", () => ({
    createItemEditingDraftUseCase: vi.fn(),
}));
vi.mock("../../../../src/usecases/itemEditing/updateConfirm.js", () => ({
    updateItemEditingConfirmUseCase: vi.fn(),
}));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
