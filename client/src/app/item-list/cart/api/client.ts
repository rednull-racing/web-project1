import { fetcher } from "@/lib/fetcher";
export { fetcher };
export const getListUrl = (pageNumber: number, searchKeyword: string) => {
    const query = `?type=cart&page=${pageNumber}`;
    return query ? `${process.env.NEXT_PUBLIC_API_URL}/users/me/items${query}${searchKeyword.trim() ? `&keyword=${encodeURIComponent(searchKeyword.trim())}` : ""}` : null;
};
