import { vi } from "vitest";
vi.mock("../../../../src/usecases/itemLike/add.js", () => ({ addItemLikeUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/itemLike/delete.js", () => ({ deleteItemLikeUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/itemLike/count.js", () => ({ itemLikeCountUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/itemLike/status.js", () => ({ itemLikeStatusUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/itemLike/userList.js", () => ({ getItemLikeUserListUseCase: vi.fn() }));

vi.mock("../../../../src/middleware/isAdmin.js", () => ({ isAdmin: vi.fn() }));
