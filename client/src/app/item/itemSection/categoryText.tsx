import CStyles from "../itemCommon.module.css";
import styles from "./item.module.css";

type Props = {
    categoryName: string;
};

export const CategoryText = ({ categoryName }: Props) => {
    return (
        <>
            <p className={CStyles.semiTitle}>カテゴリー</p>
            <p className={styles.categoryText}>{categoryName}</p>
        </>
    );
};
