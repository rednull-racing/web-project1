import { fetcher } from "@/lib/fetcher";

export { fetcher };

export const getListUrl = (pageNumber: number, searchKeyword: string, uploadedTab?: "all" | "selling" | "sold") => {
    const query =
        uploadedTab === "all"
            ? `?page=${pageNumber}`
            : uploadedTab === "selling"
              ? `?page=${pageNumber}&status=active`
              : uploadedTab === "sold"
                ? `?page=${pageNumber}&status=soldout`
                : null;
    return query
        ? `${process.env.NEXT_PUBLIC_API_URL}/items/list/uploaded${query}${searchKeyword.trim() ? `&keyword=${encodeURIComponent(searchKeyword.trim())}` : ""}`
        : null;
};
