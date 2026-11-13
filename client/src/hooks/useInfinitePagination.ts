import { useCallback, useEffect, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { fetcher } from "../lib/fetcher";
import { Key } from "swr";

type Params<T, TItem> = {
    apiKey: (pageIndex: number, previousPageData: T | null) => Key;
    getItems: (page: T) => TItem[];
    hasMore: (page: T) => boolean;
};

export function useInfinitePagination<T, TItem>({ apiKey, getItems, hasMore }: Params<T, TItem>) {
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // SWRInfinite
    const { data, mutate, setSize, isValidating } = useSWRInfinite<T>(apiKey, async (url: string) => {
        return fetcher<T>(url);
    });

    const items = data?.flatMap(getItems) ?? [];

    // 追加フェッチ
    const loadMore = useCallback(async () => {
        setIsLoadingMore(true);

        await setSize((prev) => prev + 1);

        setIsLoadingMore(false);
    }, [setSize]);

    const lastPage = data?.at(-1);

    const isReachingEnd = lastPage ? !hasMore(lastPage) : false;

    // 最下部検知
    const loadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const target = loadMoreRef.current;
        if (!target) return;

        if (isReachingEnd || isValidating) return;

        const observer = new IntersectionObserver(
            async ([entry]) => {
                if (!entry.isIntersecting) return;

                if (isLoadingMore) return;

                await loadMore();
            },
            {
                threshold: 0.1,
                rootMargin: "200px",
            },
        );

        observer.observe(target);

        return () => observer.disconnect();
    }, [isLoadingMore, isReachingEnd, isValidating, loadMore]);

    return { data, items, mutate, loadMoreRef, isLoadingMore, isReachingEnd, isValidating };
}
