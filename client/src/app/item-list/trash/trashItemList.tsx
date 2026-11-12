"use client";

import { ComponentProps, useState } from "react";
import useSWR from "swr";
import { Pagination } from "../_components/pagination";
import { SearchField } from "../_components/searchField";
import { fetcher, getListUrl } from "./api/client";
import { TrashItem } from "./trashItem";
import styles from "./trashItemList.module.css";

type TrashItemData = ComponentProps<typeof TrashItem>["itemTrash"];

type Response = {
    itemTrashList: { itemTrash: TrashItemData }[];
    totalPages: number;
};

export const TrashItemList = () => {
    const [searchValue, setSearchValue] = useState("");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [pageNumber, setPageNumber] = useState(1);

    const apiUrl = getListUrl(pageNumber, searchKeyword);
    const { data, mutate } = useSWR<Response>(apiUrl, fetcher);
    const itemTrashList = data?.itemTrashList;
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

            {itemTrashList && itemTrashList.length > 0 && (
                <main className={styles.itemListSection}>
                    {itemTrashList.map(({ itemTrash }) => (
                        <TrashItem key={itemTrash.id} itemTrash={itemTrash} mutate={mutate} />
                    ))}

                    <Pagination currentPage={pageNumber} totalPages={totalPages} onPageChange={setPageNumber} />
                </main>
            )}

            {itemTrashList?.length === 0 && <p className={styles.noItem}>商品が見つかりません</p>}
        </>
    );
};
