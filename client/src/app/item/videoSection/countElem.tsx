import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { Item } from "../itemPageTypes";
import { Like } from "./like";
import styles from "./video.module.css";

type Props = {
    id: string;
    item: Item;
    sellerMe?: boolean;
    likeCount?: number;
    isLike?: boolean;
    page: "normal" | "admin" | "draft" | "deleted";
    loggedIn: boolean;
};

export const CountElem = ({ id, item, sellerMe, likeCount, isLike, page, loggedIn }: Props) => {
    return (
        <section className={styles.countElem}>
            {["normal", "admin"].includes(page) && (
                <>
                    <div className={styles.goodDiv}>
                        <Like
                            id={id}
                            sellerMe={sellerMe}
                            initialCount={likeCount}
                            initialLike={isLike}
                            page={page as "normal" | "admin"}
                            loggedIn={loggedIn}
                        />
                    </div>

                    <div className={styles.countDiv}>
                        <p className={styles.countNumber}>{item.Video?.play_count}</p>
                        <p className={styles.countText}>views</p>
                    </div>

                    <div className={styles.countDiv}>
                        <p className={styles.countNumber}>{formatRelativeTime(item.uploaded_at)}</p>
                        <p className={styles.countText}>posted</p>
                    </div>
                </>
            )}

            {page === "draft" && (
                <div className={styles.dateFlex}>
                    <p className={styles.countText}>保存日時：</p>
                    <p className={styles.countNumber}>{formatRelativeTime(item.save_at)}</p>
                </div>
            )}

            {page === "deleted" && (
                <div className={styles.dateFlex}>
                    <p className={styles.countText}>削除日時：</p>
                    <p className={styles.countNumber}>{formatRelativeTime(item.deleted_at)}</p>
                </div>
            )}
        </section>
    );
};
