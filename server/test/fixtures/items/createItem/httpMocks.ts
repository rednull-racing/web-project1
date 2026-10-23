import { vi } from "vitest";
vi.mock("../../../../src/middleware/session.js", () => ({ sessionMiddleware: vi.fn() }));
vi.mock("../../../../src/usecases/items/update/updateItem.js", () => ({ updateItemUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/items/delete/logicalDelete.js", () => ({ deleteItemLogicallyUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/items/delete/perfectDelete.js", () => ({ deleteItemPerfectUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/items/formData/getFormData.js", () => ({ getFormDataUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/items/highlight/getItemHighlight.js", () => ({ getItemHighlightUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/items/itemList/itemList.js", () => ({ getItemListUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/items/itemList/recommendItems.js", () => ({ getRecommendItemsUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/items/itemPage/itemPage.js", () => ({ getItemPageUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/items/itemPage/metadata.js", () => ({ getMetadataUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/items/log/accessLogs.js", () => ({ patchItemLogsAccessUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/items/restore/restore.js", () => ({ restoreItemUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/items/search/getSearchItems.js", () => ({ getSearchItemsUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/items/sortNumber/sortNumber.js", () => ({
    patchSortNumberAddUseCase: vi.fn(),
    patchSortNumberDecreaseUseCase: vi.fn(),
}));
vi.mock("../../../../src/middleware/isAdmin.js", () => ({ isAdmin: vi.fn() }));
