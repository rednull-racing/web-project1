import styles from "./confirm.module.css";

type Props = {
    page: "normal" | "edit";
};

export const Title = ({ page }: Props) => {
    const title = page === "normal" ? "出品する商品の確認" : "更新する商品情報の確認";

    return <p className={styles.title}>{title}</p>;
};
