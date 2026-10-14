import { getItemsSortNumberDecayCron, updateSortNumberDecay } from "../../../services/items/index.js";

// Item.sort_number減算
export const cronDecaySortNumberUseCase = async (): Promise<void> => {
    const items = await getItemsSortNumberDecayCron({
        minSortNumber: 0.01,
    });

    for (const item of items) {
        const sortNumber = Number(item.sort_number) / 2;

        await updateSortNumberDecay({
            item,
            data: { sort_number: sortNumber },
        });
    }
};
