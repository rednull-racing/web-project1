import { vi } from "vitest";
import type { Transaction } from "sequelize";
import { makeEditing } from "./fixtures.js";
const mocks = vi.hoisted(() => ({
    transaction: vi.fn(), getMyItemEditing: vi.fn(), getUser: vi.fn(), validateMaster: vi.fn(), getCategories: vi.fn(),
    countFollower: vi.fn(), countSellItem: vi.fn(), createVideo: vi.fn(), createSale: vi.fn(), createShipping: vi.fn(), createItem: vi.fn(),
    deleteItemEditing: vi.fn(), createNotification: vi.fn(),
}));
vi.mock("../../../../src/db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../../src/services/itemEditing/query.js", () => ({ getMyItemEditing: mocks.getMyItemEditing }));
vi.mock("../../../../src/services/itemEditing/command.js", () => ({ deleteItemEditing: mocks.deleteItemEditing }));
vi.mock("../../../../src/services/users/query.js", () => ({ getUser: mocks.getUser }));
vi.mock("../../../../src/services/categories/categories.js", () => ({ getCategories: mocks.getCategories }));
vi.mock("../../../../src/services/follow/follow.js", () => ({ countFollower: mocks.countFollower }));
vi.mock("../../../../src/services/items/index.js", () => ({ createItem: mocks.createItem, countSellItem: mocks.countSellItem }));
vi.mock("../../../../src/services/video/video.js", () => ({ createVideo: mocks.createVideo }));
vi.mock("../../../../src/services/sale/sale.js", () => ({ createSale: mocks.createSale }));
vi.mock("../../../../src/services/itemShippingProfile/itemShippingProfile.js", () => ({ createShipping: mocks.createShipping }));
vi.mock("../../../../src/services/notification/notification.js", () => ({ createNotification: mocks.createNotification }));
export const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
export const setup = () => {
    vi.resetAllMocks();
    const editing = makeEditing();
    mocks.transaction.mockImplementation(async (callback: (t: Transaction) => Promise<unknown>) => callback(transaction));
    mocks.getMyItemEditing.mockResolvedValue(editing);
    mocks.getUser.mockResolvedValue({ id: 7, user_name: " ＵＳＥＲ ", user_introduction: "紹介DE", penalty_points: 5 });
    mocks.validateMaster.mockResolvedValue({ id: 21, name: " シャツ ", parent_id: 28 });
    mocks.getCategories.mockResolvedValue({ id: 28, name: " ＴＯＰＳ " });
    mocks.countFollower.mockResolvedValue(2);
    mocks.countSellItem.mockResolvedValue(3);
    mocks.createVideo.mockResolvedValue({ id: 101 });
    mocks.createSale.mockResolvedValue({ id: 202 });
    mocks.createShipping.mockResolvedValue({ id: 303 });
    mocks.createItem.mockResolvedValue(456);
    mocks.deleteItemEditing.mockResolvedValue(undefined);
    mocks.createNotification.mockResolvedValue(undefined);
    return editing;
};
export { mocks };
