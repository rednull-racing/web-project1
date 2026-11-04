"use client";

import { InputTitle } from "@/components/inputForm";
import styles from "./upload.module.css";

export type PriceValue = {
    price: number;
};

type Props = {
    value: PriceValue;
    onChange: (v: PriceValue) => void;
};

export const PriceInput = ({ value, onChange }: Props) => {
    const gain = value.price * 0.9;
    const commission = value.price * 0.1;

    const handleChangePrice = (num: number) => {
        onChange({
            ...value,
            price: num,
        });

    };

    return (
        <>
            <div className={styles.inputDiv}>
                <InputTitle title="価格" hissu />

                <div className={styles.inputTextFlex}>
                    <p className={styles.text15}>￥</p>
                    <input
                        type="text"
                        value={value.price === 0 ? "" : value.price.toLocaleString()}
                        onChange={(e) => {
                            const num = Number(e.target.value.replace(/,/g, ""));
                            handleChangePrice(num);
                        }}
                        placeholder="例：30,000"
                        className={styles.input}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={300}
                        max={1000000}
                        required
                    />
                </div>

                <p className={styles.centerSmall}>※ 300~1,000,000円の間で設定してください。</p>

                <div className={styles.text2Column}>
                    <div className={styles.textFlex}>
                        <p className={styles.textFlexTitle}>利益：</p>
                        <p className={styles.textFlexMain}>￥{gain.toLocaleString()}</p>
                    </div>

                    <div className={styles.textFlex}>
                        <p className={styles.textFlexTitle}>販売手数料：</p>
                        <p className={styles.textFlexMain}>￥{commission.toLocaleString()}</p>
                    </div>
                </div>
            </div>
        </>
    );
};
