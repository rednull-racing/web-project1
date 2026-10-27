import { formatRelativeTime } from "../../../lib/formatRelativeTime";
import CStyles from "../itemCommon.module.css";
import { ItemPeek } from "../videoSection/itemPeek";
import { Summary } from "../videoSection/summary";
import { VideoElem } from "../videoSection/videoElem";
import { VideoTitle } from "../videoSection/videoTitle";
import styles from "./draft.module.css";
import { ItemDraft } from "./types";

type Props = {
    itemDraft: ItemDraft;
    soldout: boolean;
};

export const VideoSection = ({ itemDraft, soldout }: Props) => {
    return (
        <section className={CStyles.videoSection}>
            <VideoElem
                normalPage={false}
                data={{
                    thumbnailUrl: itemDraft.thumbnail_url || "/no-image(16x9).png",
                    originalUrl: itemDraft.original_url ?? "",
                    convertedUrl: itemDraft.converted_url,
                }}
            />
            <VideoTitle title={itemDraft.title || "タイトル未入力"} />
            <ItemPeek
                data={{
                    itemName: itemDraft.name || "商品名未入力",
                    price: itemDraft.price ?? "-",
                    firstImageUrl:
                        itemDraft.first_image_url || itemDraft.image_url?.find((url) => url) || "/no-image(1x1).png",
                    genderType: itemDraft.gender_type,
                    ageType: itemDraft.age_type,
                    soldout,
                }}
            />
            <div className={styles.dateFlex}>
                <p className={styles.countText}>保存日時：</p>
                <p className={styles.countNumber}>{formatRelativeTime(itemDraft.updatedAt)}</p>
            </div>
            <Summary
                normalPage={false}
                data={{
                    itemId: null,
                    summary: itemDraft.summary ?? "",
                    soldout,
                }}
            />
        </section>
    );
};
