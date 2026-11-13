"use client";

import { useState } from "react";
import useSWR from "swr";
import { Pagination } from "../_components/pagination";
import { SearchField } from "../_components/searchField";
import { Item } from "../types";
import { fetcher, getListUrl } from "./api/client";
import { StockItem } from "./stockItem";
import styles from "./stockItemList.module.css";

type Response = {
    itemList: { item: Item }[];
    totalPages: number;
};

export const StockItemList = () => {
    const [searchValue, setSearchValue] = useState("");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [pageNumber, setPageNumber] = useState(1);

    const apiUrl = getListUrl(pageNumber, searchKeyword);
    const { data, error, mutate } = useSWR<Response>(apiUrl, fetcher);
    const itemList = data?.itemList;
    const totalPages = data?.totalPages ?? 1;

    // 検索
    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setPageNumber(1);
        setSearchValue(val);
        if (val.trim() === "") {
            setSearchKeyword("");
        }
    };

    return (
        <>
            <SearchField
                searchValue={searchValue}
                onChange={onChange}
                onSubmit={() => {
                    setPageNumber(1);
                    setSearchKeyword(searchValue);
                }}
            />

            {!error && itemList && itemList.length > 0 && (
                <main className={styles.itemListSection}>
                    {itemList.map(({ item }) => (
                        <StockItem key={item.id} item={item} mutate={mutate} />
                    ))}

                    <Pagination currentPage={pageNumber} totalPages={totalPages} onPageChange={setPageNumber} />
                </main>
            )}

            {(error || itemList?.length === 0) && <p className={styles.noItem}>商品が見つかりません</p>}
        </>
    );
};
