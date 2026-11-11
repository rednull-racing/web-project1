"use client";

import { useState } from "react";
import useSWR from "swr";
import { Pagination } from "../_components/pagination";
import { SearchField } from "../_components/searchField";
import { ItemDraft } from "../types";
import { fetcher, getListUrl } from "./api/client";
import { DraftItem } from "./draftItem";
import styles from "./draftItemList.module.css";

type Response = {
    itemDraftList: ItemDraft[];
    totalPages: number;
};

export const DraftItemList = () => {
    const [searchValue, setSearchValue] = useState("");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [pageNumber, setPageNumber] = useState(1);

    const apiUrl = getListUrl(pageNumber, searchKeyword);
    const { data, mutate } = useSWR<Response>(apiUrl, fetcher);
    const itemDraftList = data?.itemDraftList;
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

            {itemDraftList && itemDraftList.length > 0 && (
                <main className={styles.itemListSection}>
                    {itemDraftList.map((itemDraft) => (
                        <DraftItem key={itemDraft.id} itemDraft={itemDraft} mutate={mutate} />
                    ))}

                    <Pagination currentPage={pageNumber} totalPages={totalPages} onPageChange={setPageNumber} />
                </main>
            )}

            {itemDraftList?.length === 0 && <p className={styles.noItem}>商品が見つかりません</p>}
        </>
    );
};
