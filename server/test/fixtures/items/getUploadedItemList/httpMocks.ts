import "../createItem/httpMocks.js";
import { vi } from "vitest";

// 対象外usecaseを遮断し、Router/controllerのimportからDBや外部通信へ進ませない。
vi.mock("../../../../src/usecases/items/create/createItem.js", () => ({ createItemUseCase: vi.fn() }));
