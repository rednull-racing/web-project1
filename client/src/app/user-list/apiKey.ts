import { UserListResponse } from "./types";

type Params = {
    id?: string;
    page: "follow" | "item-like" | "comment-like" | "dev";
    followTab?: "follow" | "follower" | null;
    searchValue?: string;
};

export const getUserListApiKey =
    ({ id, page, followTab, searchValue }: Params) =>
    (pageIndex: number, previousPageData: UserListResponse | null) => {
        let basePath: string | null = null;

        if (page === "item-like") basePath = `item-like/${id}/user?limit=20`;
        if (page === "comment-like") basePath = `comment-like/${id}/user?limit=20`;

        if (page === "follow") {
            if (followTab === "follow") basePath = `follow/${id}/user?type=follow&limit=20`;
            else if (followTab === "follower") basePath = `follow/${id}/user?type=follower&limit=20`;
            else basePath = `follow/${id}?type=follow&limit=20`; // デフォルト
        }

        if (page === "dev") {
            if (pageIndex === 0) {
                basePath = "dev/users?limit=20";
            } else {
                basePath = `dev/users?limit=20&cursor=${previousPageData?.nextCursor}`;
            }
        }

        if (!basePath) return null;

        const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/${basePath}`);
        if (searchValue?.trim()) {
            url.searchParams.set("keyword", searchValue.trim());
        }

        return url.toString();
    };
