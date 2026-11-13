import { AlertMoney } from "../../../components";
import { User } from "../types";
import styles from "./styles.module.css";

type Props = {
    user: User;
};

export const MoneySection = ({ user }: Props) => {
    const pointLots = user.PointLots;
    const uriagekinLots = user.UriagekinLots;

    return (
        <section className={styles.moneySection}>
            <section className={styles.moneyMainBlock}>
                <div className={styles.moneyDiv}>
                    <p className={styles.moneyP}>売上金</p>
                    <p className={styles.money}>￥{user.uriagekin?.toLocaleString()}</p>
                </div>
                <div className={styles.moneyDiv}>
                    <p className={styles.moneyP}>ポイント</p>
                    <p className={styles.money}>{user.points?.toLocaleString()}pt</p>
                </div>
            </section>

            {pointLots && pointLots?.alertPoints > 0 && <AlertMoney pointLots={pointLots} mode="points" />}

            {uriagekinLots && uriagekinLots?.alertUriagekin > 0 && (
                <AlertMoney uriagekinLots={uriagekinLots} mode="uriagekin" />
            )}
        </section>
    );
};
