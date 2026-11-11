import { vi } from "vitest";
vi.mock("../../../../src/usecases/watchHistory/delete.js", () => ({ deleteWatchHistoryUseCase: vi.fn() }));

vi.mock("../../../../src/middleware/isAdmin.js", () => ({ isAdmin: vi.fn() }));
