import { NotificationResponse } from "./types";

export const getNotificationApiKey = (pageIndex: number, previousPageData: NotificationResponse | null) => {
    if (previousPageData && !previousPageData.hasMore) return null;

    if (pageIndex === 0) {
        return `${process.env.NEXT_PUBLIC_API_URL}/notification?limit=30`;
    }

    return `${process.env.NEXT_PUBLIC_API_URL}/notification?limit=30&cursor=${previousPageData?.nextCursor}`;
};
