import Link from "next/link";
import { ItemImage } from "../_components/itemImage";
import { ItemPrice } from "../_components/itemPrice";
import type { Item } from "../types";
import type { KeyedMutator } from "swr";
import styles from "./watchHistoryList.module.css";
import { RemoveFloat } from "./removeFloat";
export const WatchHistoryItem = ({ item, mutate }: {
    item: Item;
    mutate: KeyedMutator<{
        itemList: Item[];
        totalPages: number;
    }>;
}) => {
    const itemPageLink = `/item/${item.id}`;

    return (<section key={item.id} className={styles.itemSection}>
        <div className={styles.itemFlex}>
            <Link href={itemPageLink} className={styles.itemLinkArea}>
                <div className={styles.itemImageText}>
                    <ItemImage item={item} showSold={true} />
                    <div className={styles.itemTextArea}>
                        <h2 className={`${styles.itemName} ${styles.line1}`}>
                            {item.name ?? ""}
                        </h2>

                        {(["men", "women", "unisex"].includes(item.gender_type) ||
                            item.age_type === "kids") && (<div className={styles.typeRow}>
                                {item.gender_type === "men" && (<span className={`${styles.typeText} ${styles.line1}`}>
                                    メンズ
                                </span>)}
                                {item.gender_type === "women" && (<span className={`${styles.typeText} ${styles.line1}`}>
                                    レディース
                                </span>)}
                                {item.gender_type === "unisex" && (<span className={`${styles.typeText} ${styles.line1}`}>
                                    ユニセックス
                                </span>)}

                                {item.age_type === "kids" && (<span className={`${styles.typeText} ${styles.line1}`}>
                                    キッズ
                                </span>)}
                            </div>)}

                        <div className={styles.videoTitleDiv}>
                            <p className={styles.titleLabel}>動画：</p>
                            <h4 className={`${styles.videoTitle} ${styles.line1}`}>
                                {item.Video?.title ?? ""}
                            </h4>
                        </div>
                    </div>
                </div>

                <ItemPrice item={item} showSale={true} />
            </Link>

            {(<RemoveFloat item={item} mutate={mutate} />)}
        </div>

    </section>);
};
