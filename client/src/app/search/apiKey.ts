import { SearchResponse } from "./types";

type Params = {
    keyword: string;
    limit: number;
    sort: "popular" | "new" | "priceAsc" | "priceDesc";
};

export const getSearchItemListApiKey = ({ keyword, limit, sort }: Params) => {
    return (pageIndex: number, previousPageData: SearchResponse | null) => {
        if (previousPageData && !previousPageData.hasMore) return;

        if (pageIndex === 0) {
            return `${process.env.NEXT_PUBLIC_API_URL}/items/search?keyword=${keyword}&limit=${limit}&sort=${sort}`;
        }

        return `${process.env.NEXT_PUBLIC_API_URL}/items/search?keyword=${keyword}&limit=${limit}&sort=${sort}&cursorScore=${previousPageData?.nextCursorScore}&cursorId=${previousPageData?.nextCursorId}`;
    };
};
