import styles from "./video.module.css";

type Props = {
    title: string;
};

export const VideoTitle = async ({ title }: Props) => {
    return <h3 className={styles.title}>{title}</h3>;
};
