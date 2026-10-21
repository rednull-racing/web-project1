import { expect, it, vi } from "vitest";
import { seed, run, snapshot, assertRolledBack } from "../../../../fixtures/items/createItem/databaseFixtures.js";
import * as editingQuery from "../../../../../src/services/itemEditing/query.js";
import * as users from "../../../../../src/services/users/query.js";
import * as categories from "../../../../../src/services/categories/categories.js";
import * as conditions from "../../../../../src/services/itemConditionOption/itemConditionOption.js";
import * as days from "../../../../../src/services/shippingDayOption/shippingDayOption.js";
import * as services from "../../../../../src/services/shippingServiceOption/shippingServiceOption.js";
import * as places from "../../../../../src/services/todouhuken/todouhuken.js";
import * as follow from "../../../../../src/services/follow/follow.js";
import * as items from "../../../../../src/services/items/items.count.js";

// 実SQL完了直後にだけ障害を注入し、先行ロックの解放と保存データ不変を検証する。
const stages = [
    {
        name: "元行取得",
        inject: (failure: Error) => {
            const real = editingQuery.getMyItemEditing;
            vi.spyOn(editingQuery, "getMyItemEditing").mockImplementationOnce(async (args) => {
                await real(args);
                throw failure;
            });
        },
    },
    {
        name: "出品者",
        inject: (failure: Error) => {
            const real = users.getUser;
            vi.spyOn(users, "getUser").mockImplementationOnce(async (args) => {
                await real(args);
                throw failure;
            });
        },
    },
    {
        name: "子カテゴリー",
        inject: (failure: Error) => {
            const real = categories.getCategories;
            vi.spyOn(categories, "getCategories").mockImplementationOnce(async (args) => {
                await real(args);
                throw failure;
            });
        },
    },
    {
        name: "状態マスター",
        inject: (failure: Error) => {
            const real = conditions.getItemCondition;
            vi.spyOn(conditions, "getItemCondition").mockImplementationOnce(async (args) => {
                await real(args);
                throw failure;
            });
        },
    },
    {
        name: "配送日",
        inject: (failure: Error) => {
            const real = days.getShippingDay;
            vi.spyOn(days, "getShippingDay").mockImplementationOnce(async (args) => {
                await real(args);
                throw failure;
            });
        },
    },
    {
        name: "配送サービス",
        inject: (failure: Error) => {
            const real = services.getShippingService;
            vi.spyOn(services, "getShippingService").mockImplementationOnce(async (args) => {
                await real(args);
                throw failure;
            });
        },
    },
    {
        name: "発送元",
        inject: (failure: Error) => {
            const real = places.getTodouhuken;
            vi.spyOn(places, "getTodouhuken").mockImplementationOnce(async (args) => {
                await real(args);
                throw failure;
            });
        },
    },
    {
        name: "親カテゴリー",
        inject: (failure: Error) => {
            const real = categories.getCategories;
            let count = 0;
            vi.spyOn(categories, "getCategories").mockImplementation(async (args) => {
                const row = await real(args);
                if (++count === 2) throw failure;
                return row;
            });
        },
    },
    {
        name: "follower集計",
        inject: (failure: Error) => {
            const real = follow.countFollower;
            vi.spyOn(follow, "countFollower").mockImplementationOnce(async (args) => {
                await real(args);
                throw failure;
            });
        },
    },
    {
        name: "出品数集計",
        inject: (failure: Error) => {
            const real = items.countSellItem;
            vi.spyOn(items, "countSellItem").mockImplementationOnce(async (args) => {
                await real(args);
                throw failure;
            });
        },
    },
];
it.each(stages)("T05 D03: $nameの実参照直後の障害はrollback・ロック解放", async ({ inject }) => {
    const f = await seed();
    const before = await snapshot("item_editing", f.editing.id);
    const failure = new Error("read boundary failure");
    inject(failure);
    await expect(run(f)).rejects.toBe(failure);
    await assertRolledBack(f, before);
});
