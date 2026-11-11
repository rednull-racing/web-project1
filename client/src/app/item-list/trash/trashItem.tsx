import { formatRelativeTime } from "@/lib/formatRelativeTime";
import Link from "next/link";
import type { KeyedMutator } from "swr";
import { ItemImage } from "../_components/itemImage";
import { ItemPrice } from "../_components/itemPrice";
import type { ItemTrash } from "../types";
import styles from "./trashItemList.module.css";

export const TrashItem = ({
    itemTrash,
}: {
    itemTrash: ItemTrash;
    mutate: KeyedMutator<{
        itemTrashList: ItemTrash[];
        totalPages: number;
    }>;
}) => {
    const itemPageLink = `/item/deleted/${itemTrash.id}`;
    const previewDateLabel = "削除日時";
    const previewDate = formatRelativeTime(itemTrash.createdAt);

    return (
        <section key={itemTrash.id} className={styles.itemSection}>
            <div className={styles.itemFlex}>
                <Link href={itemPageLink} className={styles.itemLinkArea}>
                    <div className={styles.itemImageText}>
                        <ItemImage
                            data={{
                                first_image_url: itemTrash.first_image_url,
                                status: null,
                            }}
                            showSold={false}
                        />
                        <div className={styles.itemTextArea}>
                            <h2 className={`${styles.itemName} ${styles.line1}`}>{itemTrash.name ?? ""}</h2>

                            {
                                <div className={styles.dateDiv}>
                                    <p className={`${styles.dateText} ${styles.line1}`}>{previewDateLabel}:</p>
                                    <p className={`${styles.dateText} ${styles.line1}`}>{previewDate}</p>
                                </div>
                            }

                            <div className={styles.videoTitleDiv}>
                                <p className={styles.titleLabel}>動画：</p>
                                <h4 className={`${styles.videoTitle} ${styles.line1}`}>{itemTrash.title ?? ""}</h4>
                            </div>
                        </div>
                    </div>

                    <ItemPrice
                        data={{
                            price: itemTrash.price,
                            sale_flag: false,
                            before_price: 0,
                            discount_rate: 0,
                            discount_amount: 0,
                        }}
                        showSale={false}
                    />
                </Link>
            </div>
        </section>
    );
};
