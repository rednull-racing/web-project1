import { Item } from "../itemPageTypes";
import { Report } from "../others/report";
import { CountElem } from "./countElem";
import { ItemPeek } from "./itemPeek";
import { Summary } from "./summary";
import { UserSection } from "./userSection";
import styles from "./video.module.css";
import { VideoElem } from "./videoElem";
import { VideoTitle } from "./videoTitle";

type Props = {
    id: string;
    item: Item;
    sellerMe?: boolean;
    likeCount?: number;
    isLike?: boolean;
    page: "normal" | "admin" | "deleted";
    reportCount?: number;
    userId: string | null;
    loggedIn: boolean;
};

export const VideoSection = ({ id, item, sellerMe, likeCount, isLike, page, reportCount, userId, loggedIn }: Props) => {
    if (!item.Video) return;
    return (
        <section className={styles.videoSection}>
            <VideoElem
                sellerMe={sellerMe}
                normalPage={page === "normal"}
                data={{
                    videoId: item.Video.id,
                    thumbnailUrl: item.Video.thumbnail_url,
                    originalUrl: item.Video.original_url,
                    convertedUrl: item.Video.converted_url,
                }}
            />
            <VideoTitle title={item.Video?.title} />
            <ItemPeek
                data={{
                    itemName: item.name,
                    price: item.price,
                    firstImageUrl: item.first_image_url,
                    genderType: item.gender_type,
                    ageType: item.age_type,
                    soldout: item.status === "soldout",
                }}
            />
            <CountElem
                id={id}
                item={item}
                sellerMe={sellerMe}
                likeCount={likeCount}
                isLike={isLike}
                page={page}
                loggedIn={loggedIn}
            />
            <Summary
                data={{ itemId: id, summary: item.Video.summary, soldout: item.status === "soldout" }}
                sellerMe={sellerMe}
                normalPage={page === "normal"}
            />
            {["normal", "admin"].includes(page) && (
                <>
                    <UserSection item={item} sellerMe={sellerMe} page={page as "normal" | "admin"} userId={userId} />

                    {!sellerMe && (
                        <Report id={id} itemReport={true} page={page as "normal" | "admin"} reportCount={reportCount} />
                    )}
                </>
            )}
        </section>
    );
};
