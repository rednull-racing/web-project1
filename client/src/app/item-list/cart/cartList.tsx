"use client";

import { ItemListRow } from "@/components";
import { Items } from "@/types/itemListTypes";
import { useState } from "react";
import useSWR from "swr";
import { Pagination } from "../_components/pagination";
import { SearchField } from "../_components/searchField";
import { Item } from "../types";
import { fetcher, getListUrl } from "./api/client";
import { CartItem } from "./cartItem";
import styles from "./cartList.module.css";

type Props = {
    relatedItemList?: Items[];
};

type Response = {
    itemList: { item: Item }[];
    totalPages: number;
};

export const CartList = ({ relatedItemList }: Props) => {
    const [searchValue, setSearchValue] = useState("");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [pageNumber, setPageNumber] = useState(1);

    const apiUrl = getListUrl(pageNumber, searchKeyword);
    const { data, mutate } = useSWR<Response>(apiUrl, fetcher);
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

            {itemList && itemList.length > 0 && (
                <main className={styles.itemListSection}>
                    {itemList.map(({ item }) => (
                        <CartItem key={item.id} item={item} mutate={mutate} />
                    ))}

                    <Pagination currentPage={pageNumber} totalPages={totalPages} onPageChange={setPageNumber} />

                    {relatedItemList && relatedItemList.length > 1 && (
                        <nav className={styles.related}>
                            <ItemListRow itemList={relatedItemList} />
                        </nav>
                    )}
                </main>
            )}

            {itemList?.length === 0 && <p className={styles.noItem}>商品が見つかりません</p>}
        </>
    );
};
