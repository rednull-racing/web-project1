import { getItemsSortBuzzNumberDecayCron, updateSortBuzzNumberDecay } from "../../../services/items/index.js";

// Item.sort_buzz_number減算
export const cronDecaySortBuzzNumberUseCase = async (): Promise<void> => {
    const items = await getItemsSortBuzzNumberDecayCron({
        minSortNumber: 0.01,
    });

    for (const item of items) {
        const sortBuzzNumber = Number(item.sort_buzz_number) / 2;

        await updateSortBuzzNumberDecay({
            item,
            data: { sort_buzz_number: sortBuzzNumber },
        });
    }
};
