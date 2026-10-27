import { formatRelativeTime } from "../../../lib/formatRelativeTime";
import CStyles from "../itemCommon.module.css";
import { ItemPeek } from "../videoSection/itemPeek";
import { Summary } from "../videoSection/summary";
import { VideoElem } from "../videoSection/videoElem";
import { VideoTitle } from "../videoSection/videoTitle";
import styles from "./confirm.module.css";
import { ItemEditing } from "./types";

type Props = {
    itemEditing: ItemEditing;
    soldout: boolean;
};

export const VideoSection = ({ itemEditing, soldout }: Props) => {
    return (
        <section className={CStyles.videoSection}>
            <VideoElem
                sellerMe={false}
                normalPage={false}
                data={{
                    thumbnailUrl: itemEditing.thumbnail_url,
                    originalUrl: itemEditing.original_url,
                    convertedUrl: itemEditing.converted_url,
                }}
            />
            <VideoTitle title={itemEditing.title} />
            <ItemPeek
                data={{
                    itemName: itemEditing.name,
                    price: itemEditing.price,
                    firstImageUrl: itemEditing.first_image_url,
                    genderType: itemEditing.gender_type,
                    ageType: itemEditing.age_type,
                    soldout,
                }}
            />
            <div className={styles.dateFlex}>
                <p className={styles.countText}>保存日時：</p>
                <p className={styles.countNumber}>{formatRelativeTime(itemEditing.updatedAt)}</p>
            </div>
            <Summary
                data={{
                    itemId: null,
                    summary: itemEditing.summary ?? "",
                    soldout,
                }}
                sellerMe={false}
                page="confirm"
            />
        </section>
    );
};
