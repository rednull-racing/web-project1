import { formatRelativeTime } from "@/lib/formatRelativeTime";
import Link from "next/link";
import type { KeyedMutator } from "swr";
import { ItemImage } from "../_components/itemImage";
import { ItemPrice } from "../_components/itemPrice";
import type { ItemDraft, DraftListResponse } from "./types";
import styles from "./draftItemList.module.css";
import { RemoveFloat } from "./removeFloat";

export const DraftItem = ({ itemDraft, mutate }: { itemDraft: ItemDraft; mutate: KeyedMutator<DraftListResponse> }) => {
    const itemPageLink = `/item/draft/${itemDraft.id}`;
    const previewDateLabel = "保存日時";
    const previewDate = formatRelativeTime(itemDraft.createdAt);

    return (
        <section key={itemDraft.id} className={styles.itemSection}>
            <div className={styles.itemFlex}>
                <Link href={itemPageLink} className={styles.itemLinkArea}>
                    <div className={styles.itemImageText}>
                        <ItemImage
                            data={{
                                first_image_url: itemDraft.first_image_url ?? "",
                                status: null,
                            }}
                            showSold={false}
                        />
                        <div className={styles.itemTextArea}>
                            <h2 className={`${styles.itemName} ${styles.line1}`}>{itemDraft.name ?? ""}</h2>

                            {
                                <div className={styles.dateDiv}>
                                    <p className={`${styles.dateText} ${styles.line1}`}>{previewDateLabel}:</p>
                                    <p className={`${styles.dateText} ${styles.line1}`}>{previewDate}</p>
                                </div>
                            }

                            <div className={styles.videoTitleDiv}>
                                <p className={styles.titleLabel}>動画：</p>
                                <h4 className={`${styles.videoTitle} ${styles.line1}`}>{itemDraft.title ?? ""}</h4>
                            </div>
                        </div>
                    </div>

                    <ItemPrice
                        data={{
                            price: itemDraft.price ?? "-",
                            sale_flag: false,
                            before_price: 0,
                            discount_rate: 0,
                            discount_amount: 0,
                        }}
                        showSale={false}
                    />
                </Link>

                {<RemoveFloat itemDraftId={itemDraft.id} mutate={mutate} />}
            </div>
        </section>
    );
};
