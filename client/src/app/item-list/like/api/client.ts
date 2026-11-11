import { apiFetch } from "@/lib/api/client";
import { fetcher } from "@/lib/fetcher";

export { fetcher };

export const getListUrl = (pageNumber: number, searchKeyword: string) => {
    const query = `?page=${pageNumber}`;
    return query
        ? `${process.env.NEXT_PUBLIC_API_URL}/item-like/item-list${query}${searchKeyword.trim() ? `&keyword=${encodeURIComponent(searchKeyword.trim())}` : ""}`
        : null;
};

export const fetchRemoveItem = (path: string) => {
    return apiFetch(path, {
        method: "DELETE",
    });
};
