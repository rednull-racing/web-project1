import Link from "next/link";
import { ItemImage } from "../_components/itemImage";
import { ItemPrice } from "../_components/itemPrice";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { Item } from "../types";
import type { KeyedMutator } from "swr";
import styles from "./trashItemList.module.css";
export const TrashItem = ({ item }: {
    item: Item;
    mutate: KeyedMutator<{
        itemList: Item[];
        totalPages: number;
    }>;
}) => {
    const itemPageLink = `/item/deleted/${item.id}`;
    const previewDateLabel = "削除日時";
    const previewDate = formatRelativeTime(item.save_at);
    return (<section key={item.id} className={styles.itemSection}>
        <div className={styles.itemFlex}>
            <Link href={itemPageLink} className={styles.itemLinkArea}>
                <div className={styles.itemImageText}>
                    <ItemImage item={item} showSold={false} />
                    <div className={styles.itemTextArea}>
                        <h2 className={`${styles.itemName} ${styles.line1}`}>
                            {item.name ?? ""}
                        </h2>

                        {(<div className={styles.dateDiv}>
                            <p className={`${styles.dateText} ${styles.line1}`}>
                                {previewDateLabel}:
                            </p>
                            <p className={`${styles.dateText} ${styles.line1}`}>
                                {previewDate}
                            </p>
                        </div>)}

                        <div className={styles.videoTitleDiv}>
                            <p className={styles.titleLabel}>動画：</p>
                            <h4 className={`${styles.videoTitle} ${styles.line1}`}>
                                {item.Video?.title ?? ""}
                            </h4>
                        </div>
                    </div>
                </div>

                <ItemPrice item={item} showSale={false} />
            </Link>

        </div>

    </section>);
};
