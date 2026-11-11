import { fetcher } from "@/lib/fetcher";

export { fetcher };

export const getListUrl = (pageNumber: number, searchKeyword: string) => {
    const query = `?page=${pageNumber}`;
    return query
        ? `${process.env.NEXT_PUBLIC_API_URL}/item-trash/list${query}${searchKeyword.trim() ? `&keyword=${encodeURIComponent(searchKeyword.trim())}` : ""}`
        : null;
};
