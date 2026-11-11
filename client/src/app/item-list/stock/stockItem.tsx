import Link from "next/link";
import type { KeyedMutator } from "swr";
import { ItemImage } from "../_components/itemImage";
import { ItemPrice } from "../_components/itemPrice";
import type { Item } from "../types";
import styles from "./stockItemList.module.css";

export const StockItem = ({
    item,
}: {
    item: Item;
    mutate: KeyedMutator<{
        itemList: Item[];
        totalPages: number;
    }>;
}) => {
    const itemPageLink = `/item/${item.id}`;

    return (
        <section key={item.id} className={styles.itemSection}>
            <div className={styles.itemFlex}>
                <Link href={itemPageLink} className={styles.itemLinkArea}>
                    <div className={styles.itemImageText}>
                        <ItemImage item={item} showSold={false} />
                        <div className={styles.itemTextArea}>
                            <h2 className={`${styles.itemName} ${styles.line1}`}>{item.name ?? ""}</h2>

                            {
                                <div className={styles.stockDiv}>
                                    <p className={styles.stockLabel}>在庫数：</p>
                                    <p className={`${styles.stock} ${styles.line1}`}>
                                        {item.attributes.inventory?.current.toLocaleString()}
                                    </p>
                                </div>
                            }

                            <div className={styles.videoTitleDiv}>
                                <p className={styles.titleLabel}>動画：</p>
                                <h4 className={`${styles.videoTitle} ${styles.line1}`}>{item.Video?.title ?? ""}</h4>
                            </div>
                        </div>
                    </div>

                    <ItemPrice item={item} showSale={true} />
                </Link>
            </div>
        </section>
    );
};
