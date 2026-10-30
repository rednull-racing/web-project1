"use client";

import { ItemListRow } from "@/components";
import { fetcher } from "@/lib/fetcher";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { Items } from "@/types/itemListTypes";
import { faAnglesLeft, faAnglesRight, faSearch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { CartElement } from "./cartElement";
import styles from "./itemList.module.css";
import { RemoveFloat } from "./removeFloat";
import { Item } from "./types";

type Props = {
    page: "cart" | "deleted" | "draft" | "like" | "stock" | "uploaded" | "watch-history";
    uploadedTab?: "all" | "selling" | "sold";
    relatedItemList?: Items[];
};

type Response = {
    itemList: Item[];
    totalPages: number;
};

export const ItemList = ({ page, uploadedTab, relatedItemList }: Props) => {
    const [searchValue, setSearchValue] = useState("");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [pageNumber, setPageNumber] = useState(1);

    // apiフェッチ
    const getApiQuery = () => {
        if (page === "cart") return `?type=cart&page=${pageNumber}`;
        if (page === "draft") return `?type=draft&page=${pageNumber}`;
        if (page === "deleted") return `?type=deleted&page=${pageNumber}`;
        if (page === "like") return `?type=like&page=${pageNumber}`;
        if (page === "watch-history") return `?type=watchHistory&page=${pageNumber}`;
        if (page === "stock") return `?type=stock&page=${pageNumber}`;
        if (page === "uploaded") {
            if (uploadedTab === "all") return `?type=uploaded&page=${pageNumber}`;
            if (uploadedTab === "selling") return `?type=uploaded&page=${pageNumber}&status=active`;
            if (uploadedTab === "sold") return `?type=uploaded&page=${pageNumber}&status=soldout`;
        }

        return null;
    };

    const apiQuery = getApiQuery();

    const apiUrl = apiQuery
        ? `${process.env.NEXT_PUBLIC_API_URL}/users/me/items${apiQuery}${
              searchKeyword.trim() ? `&keyword=${encodeURIComponent(searchKeyword.trim())}` : ""
          }`
        : null;

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

    // ページネーション
    const renderPagination = (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => {
        if (totalPages <= 1) return null;

        const pages: (number | string)[] = [];
        const delta = typeof window !== "undefined" && window.innerWidth >= 768 ? 2 : 1;

        pages.push(1);

        if (currentPage - delta > 2) pages.push("...");

        for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
            pages.push(i);
        }

        if (currentPage + delta < totalPages - 1) pages.push("...");

        if (totalPages > 1) pages.push(totalPages);

        return (
            <div className={styles.pagination}>
                <button
                    type="button"
                    disabled={currentPage === 1}
                    className={styles.pageButtonIcon}
                    onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                    title="前へ"
                >
                    <FontAwesomeIcon icon={faAnglesLeft} className={styles.pageIcon} />
                </button>

                {pages.map((p, idx) =>
                    p === "..." ? (
                        <span key={idx} className={styles.ellipsis}>
                            ...
                        </span>
                    ) : (
                        <button
                            type="button"
                            key={idx}
                            className={`${styles.pageButton} ${currentPage === p ? styles.active : ""}`}
                            onClick={() => onPageChange(p as number)}
                        >
                            {p}
                        </button>
                    ),
                )}

                <button
                    type="button"
                    disabled={currentPage === totalPages}
                    className={styles.pageButtonIcon}
                    onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                    title="次へ"
                >
                    <FontAwesomeIcon icon={faAnglesRight} className={styles.pageIcon} />
                </button>
            </div>
        );
    };

    return (
        <>
            <section className={styles.searchSection}>
                <input
                    type="text"
                    name="itemList_search"
                    placeholder="検索"
                    className={styles.searchInput}
                    value={searchValue}
                    onChange={onChange}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            setPageNumber(1);
                            setSearchKeyword(searchValue);
                        }
                    }}
                    autoComplete="off"
                />
                <FontAwesomeIcon
                    icon={faSearch}
                    name="search_icon"
                    className={`
                ${styles.searchIcon} 
                ${searchValue.trim() ? styles.activeIcon : ""}
            `}
                    onClick={() => {
                        setPageNumber(1);
                        setSearchKeyword(searchValue);
                    }}
                />
            </section>

            {itemList && itemList.length > 0 && (
                <main className={styles.itemListSection}>
                    {itemList.map((item) => {
                        let itemPageLink = "";

                        if (["cart", "good", "stock", "uploaded", "watch-history"].includes(page)) {
                            itemPageLink = `/item/${item.id}`;
                        } else if (page === "draft") {
                            itemPageLink = `/item/draft/${item.id}`;
                        } else if (page === "deleted") {
                            itemPageLink = `/item/deleted/${item.id}`;
                        }

                        const previewDateLabel = page === "draft" ? "保存日時" : page === "deleted" ? "削除日時" : "";

                        let previewDate = "";

                        if (["deleted", "draft"].includes(page)) {
                            previewDate = formatRelativeTime(item.save_at);
                        }

                        return (
                            <section key={item.id} className={styles.itemSection}>
                                <div className={styles.itemFlex}>
                                    <Link href={itemPageLink} className={styles.itemLinkArea}>
                                        <div className={styles.itemImageText}>
                                            <div className={styles.imageDiv}>
                                                <Image
                                                    src={item.first_image_url || "/no-image(1x1).png"}
                                                    alt="商品画像"
                                                    width={80}
                                                    height={80}
                                                    className={styles.image}
                                                />

                                                {["uploaded", "good", "watch-history"].includes(page) &&
                                                    item.status === "soldout" && (
                                                        <div className={styles.sold}>
                                                            <p className={styles.soldP}>SOLD</p>
                                                        </div>
                                                    )}
                                            </div>

                                            <div className={styles.itemTextArea}>
                                                <h2 className={`${styles.itemName} ${styles.line1}`}>
                                                    {item.name ?? ""}
                                                </h2>

                                                {["deleted", "draft"].includes(page) && (
                                                    <div className={styles.dateDiv}>
                                                        <p className={`${styles.dateText} ${styles.line1}`}>
                                                            {previewDateLabel}:
                                                        </p>
                                                        <p className={`${styles.dateText} ${styles.line1}`}>
                                                            {previewDate}
                                                        </p>
                                                    </div>
                                                )}

                                                {["cart", "good", "watch-history", "uploaded"].includes(page) &&
                                                    (["men", "women", "unisex"].includes(item.gender_type) ||
                                                        item.age_type === "kids") && (
                                                        <div className={styles.typeRow}>
                                                            {item.gender_type === "men" && (
                                                                <span className={`${styles.typeText} ${styles.line1}`}>
                                                                    メンズ
                                                                </span>
                                                            )}
                                                            {item.gender_type === "women" && (
                                                                <span className={`${styles.typeText} ${styles.line1}`}>
                                                                    レディース
                                                                </span>
                                                            )}
                                                            {item.gender_type === "unisex" && (
                                                                <span className={`${styles.typeText} ${styles.line1}`}>
                                                                    ユニセックス
                                                                </span>
                                                            )}

                                                            {item.age_type === "kids" && (
                                                                <span className={`${styles.typeText} ${styles.line1}`}>
                                                                    キッズ
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                {/* カラー別作るかも */}
                                                {page === "stock" && (
                                                    <div className={styles.stockDiv}>
                                                        <p className={styles.stockLabel}>在庫数：</p>
                                                        <p className={`${styles.stock} ${styles.line1}`}>
                                                            {item.attributes.inventory?.current.toLocaleString()}
                                                        </p>
                                                    </div>
                                                )}

                                                <div className={styles.videoTitleDiv}>
                                                    <p className={styles.titleLabel}>動画：</p>
                                                    <h4 className={`${styles.videoTitle} ${styles.line1}`}>
                                                        {item.Video?.title ?? ""}
                                                    </h4>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.priceColumn}>
                                            <h3 className={styles.price}>￥{item.price.toLocaleString()}</h3>
                                            {["cart", "stock", "uploaded", "good", "watch-history"].includes(page) &&
                                                item.Sale?.sale_flag && (
                                                    <>
                                                        <p className={styles.beforePrice}>
                                                            ￥{item.Sale?.before_price.toLocaleString()}
                                                        </p>
                                                        {item.Sale?.discount_rate > 0 && (
                                                            <span className={styles.sale}>
                                                                {item.Sale?.discount_rate.toLocaleString()}% OFF
                                                            </span>
                                                        )}
                                                        {item.Sale?.discount_amount > 0 && (
                                                            <span className={styles.sale}>
                                                                {item.Sale?.discount_amount.toLocaleString()}円引き
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                        </div>
                                    </Link>

                                    {["draft", "good", "watch-history"].includes(page) && (
                                        <RemoveFloat item={item} page={page} mutate={mutate} />
                                    )}
                                </div>

                                {page === "cart" && <CartElement item={item} mutate={mutate} />}
                            </section>
                        );
                    })}

                    {renderPagination(pageNumber, totalPages, (p) => {
                        setPageNumber(p);
                    })}

                    {page === "cart" && relatedItemList && relatedItemList.length > 1 && (
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
