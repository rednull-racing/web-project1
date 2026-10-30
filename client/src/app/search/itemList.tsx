"use client";

import { faList, faPlay } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useInfinitePagination } from "../../hooks/useInfinitePagination";
import { formatDuration } from "../../lib/formatDuration";
import { getSearchItemListApiKey } from "./apiKey";
import { FilterMenu } from "./filter/filterMenu/filterMenu";
import styles from "./searchItemList.module.css";
import { Item, SearchResponse } from "./types";

type Props = {
    keyword: string;
    sort: "popular" | "new" | "priceAsc" | "priceDesc";
};

export const SearchItemList = ({ keyword, sort }: Props) => {
    const [viewMode, setViewMode] = useState<"item" | "video">("video");
    const [limit, setLimit] = useState(36);
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        if (window.innerWidth >= 768) setIsDesktop(true);

        if (!isDesktop && viewMode === "item") {
            setLimit(18);
        } else if (viewMode === "video") {
            if (!isDesktop) {
                setLimit(6);
            } else {
                setLimit(18);
            }
        }
    }, []);

    // 無限スクロール
    const { items, loadMoreRef } = useInfinitePagination<SearchResponse, Item>({
        apiKey: getSearchItemListApiKey({ keyword, limit, sort }),
        getItems: (page) => page.itemList,
        hasMore: (page) => page.hasMore,
    });

    return (
        <>
            {items.length > 0 && (
                <>
                    <div className={styles.headerButtonFlex}>
                        <FilterMenu isDesktop={isDesktop} sort={sort} keyword={keyword} />

                        {viewMode === "video" && (
                            <button type="button" className={styles.stateButton} onClick={() => setViewMode("item")}>
                                <FontAwesomeIcon icon={faList} className={styles.stateIcon} />
                                商品一覧
                            </button>
                        )}
                        {viewMode === "item" && (
                            <button type="button" className={styles.stateButton} onClick={() => setViewMode("video")}>
                                <FontAwesomeIcon icon={faPlay} className={styles.stateIcon} />
                                動画一覧
                            </button>
                        )}
                    </div>

                    {viewMode === "item" && (
                        <section className={styles.itemListWrapper}>
                            {items.map((item) => {
                                if (!item) return;
                                const itemLink = `/item/${item.id}`;

                                return (
                                    <section className={styles.itemListSection} key={item.id}>
                                        <Link href={itemLink}>
                                            <div className={styles.ILImageDiv}>
                                                <Image
                                                    src={
                                                        item.first_image_url
                                                            ? encodeURI(item.first_image_url.trim())
                                                            : "/no-image(1x1).png"
                                                    }
                                                    alt={item.name}
                                                    fill
                                                    sizes="(max-width: 768px) 33vw, 16.66vw"
                                                    priority={false}
                                                    className={styles.itemImage}
                                                />
                                                {item.status === "soldout" && (
                                                    <div className={styles.ILSold}>
                                                        <p className={styles.ILSoldP}>SOLD</p>
                                                    </div>
                                                )}
                                                {item.Sale?.sale_flag && (
                                                    <div className={styles.ILSaleDiv}>
                                                        {item.Sale?.discount_rate > 0 && (
                                                            <p className={styles.ILSaleText}>
                                                                {item.Sale.discount_rate}% OFF
                                                            </p>
                                                        )}
                                                        {item.Sale?.discount_amount > 0 && (
                                                            <p className={styles.ILSaleText}>
                                                                {item.Sale.discount_amount.toLocaleString()}円引き
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                                <div className={styles.ILPrice}>￥{item.price.toLocaleString()}</div>
                                            </div>

                                            <p className={clsx(styles.ILItemName, styles.line2)}>{item.name}</p>
                                        </Link>
                                    </section>
                                );
                            })}
                        </section>
                    )}

                    {viewMode === "video" && (
                        <section className={styles.videoListWrapper}>
                            {items.map((item) => {
                                if (!item) return;
                                const itemLink = `/item/${item.id}`;

                                return (
                                    <section className={styles.videoListSection} key={item.id}>
                                        <Link href={itemLink} className={styles.thumbnail}>
                                            <Image
                                                src={
                                                    item.Video?.thumbnail_url
                                                        ? encodeURI(item.Video.thumbnail_url.trim())
                                                        : "/no-image(16x9).png"
                                                }
                                                alt={item.Video?.title ?? "動画サムネイル"}
                                                fill
                                                priority={false}
                                            />

                                            <div className={styles.duration}>
                                                {formatDuration(item.Video?.duration)}
                                            </div>

                                            {item.status === "soldout" && (
                                                <div className={styles.soldoutOverlay}>
                                                    <span className={styles.soldoutOverlayText}>SOLD OUT</span>
                                                </div>
                                            )}
                                        </Link>

                                        <div className={styles.itemData}>
                                            <Link href={itemLink} className={styles.videoUser}>
                                                <Image
                                                    src={item.User?.profile_image || "/default-profile.png"}
                                                    alt="プロフィール画像"
                                                    width={36}
                                                    height={36}
                                                    className={styles.profileImage}
                                                />
                                                <div className="flex-1">
                                                    <p className={clsx(styles.title, styles.line2)}>
                                                        {item.Video?.title}
                                                    </p>
                                                    <p className={styles.userName}>{item.User?.user_name}</p>
                                                </div>
                                            </Link>

                                            <Link href={itemLink} className={styles.itemNamePrice}>
                                                <p className={styles.syohin}>商品</p>
                                                <div className={styles.itemNameDiv}>
                                                    <h2 className={styles.itemName}>{item.name}</h2>
                                                </div>
                                                <div className={styles.itemPriceSale}>
                                                    {item.Sale?.sale_flag && (
                                                        <p className={styles.beforePrice}>
                                                            ￥{item.Sale.before_price.toLocaleString()}
                                                        </p>
                                                    )}
                                                    <h3
                                                        className={clsx(
                                                            styles.price,
                                                            item.Sale?.sale_flag ? styles.sale : "",
                                                        )}
                                                    >
                                                        ￥{item.price.toLocaleString()}
                                                    </h3>
                                                </div>
                                            </Link>
                                        </div>
                                    </section>
                                );
                            })}
                        </section>
                    )}
                </>
            )}

            {items.length === 0 && <p className={styles.noItems}>検索結果はありません</p>}

            <div ref={loadMoreRef} />
        </>
    );
};
