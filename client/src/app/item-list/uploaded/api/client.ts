import { fetcher } from "@/lib/fetcher";

export { fetcher };

export const getListUrl = (pageNumber: number, searchKeyword: string, uploadedTab?: "all" | "selling" | "sold") => {
    const query =
        uploadedTab === "all"
            ? `?type=uploaded&page=${pageNumber}`
            : uploadedTab === "selling"
              ? `?type=uploaded&page=${pageNumber}&status=active`
              : uploadedTab === "sold"
                ? `?type=uploaded&page=${pageNumber}&status=soldout`
                : null;
    return query
        ? `${process.env.NEXT_PUBLIC_API_URL}/users/me/items${query}${searchKeyword.trim() ? `&keyword=${encodeURIComponent(searchKeyword.trim())}` : ""}`
        : null;
};
