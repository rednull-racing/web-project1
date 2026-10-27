import styles from "./itemCommon.module.css";
import { Item } from "./itemPageTypes";
import { ItemSection } from "./itemSection/itemSection";
import { SellerSectionTop } from "./sellerSection/sellerSectionTop";
import { VideoSection } from "./videoSection/videoSection";

type Props = {
    id: string;
    item: Item;
    sellerMe?: boolean;
    page: "normal" | "admin" | "draft" | "deleted";
    likeCount?: number;
    isLike?: boolean;
    reportCount?: number;
    userId: string | null;
    loggedIn: boolean;
};

export const Main = ({ id, item, sellerMe, page, likeCount, isLike, reportCount, userId, loggedIn }: Props) => {
    return (
        <main className={styles.main2column}>
            <div className={styles.left2column}>
                {sellerMe && page === "normal" && <SellerSectionTop id={id} item={item} />}
                <VideoSection
                    id={id}
                    item={item}
                    sellerMe={sellerMe}
                    likeCount={likeCount}
                    isLike={isLike}
                    page={page}
                    reportCount={reportCount}
                    userId={userId}
                    loggedIn={loggedIn}
                />
            </div>
            <ItemSection id={id} item={item} sellerMe={sellerMe} page={page} loggedIn={loggedIn} />
        </main>
    );
};
