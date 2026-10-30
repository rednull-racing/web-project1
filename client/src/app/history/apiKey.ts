import { PointsHistoryResponse, UriagekinHistoryResponse } from "./types";

export const getPointsHistoryApiKey = (pageIndex: number, previousPageData: PointsHistoryResponse | null) => {
    if (previousPageData && !previousPageData.hasMore) return null;

    if (pageIndex === 0) {
        return `${process.env.NEXT_PUBLIC_API_URL}/points-history?limit=30`;
    }

    return `${process.env.NEXT_PUBLIC_API_URL}/points-history?limit=30&cursor=${previousPageData?.nextCursor}`;
};

export const getUriagekinHistoryApiKey = (pageIndex: number, previousPageData: UriagekinHistoryResponse | null) => {
    if (previousPageData && !previousPageData.hasMore) return null;

    if (pageIndex === 0) {
        return `${process.env.NEXT_PUBLIC_API_URL}/uriagekin-history?limit=30`;
    }

    return `${process.env.NEXT_PUBLIC_API_URL}/uriagekin-history?limit=30&cursor=${previousPageData?.nextCursor}`;
};
