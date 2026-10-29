"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../../lib/api/apiError";
import { sleep } from "../../../lib/sleep";
import { fetchDeleteDraftItem } from "./api/client";
import styles from "./draft.module.css";

import { useOperation } from "../../../components/operation/operation";

type Props = {
    id: string;
};

export const DeleteItemDraft = ({ id }: Props) => {
    const [popup, setPopup] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const deletingRef = useRef(false);
    const router = useRouter();
    const operation = useOperation();
    const titleId = useId();
    const opener = useRef<HTMLButtonElement>(null);
    const dialog = useRef<HTMLDivElement>(null);
    const close = () => { setPopup(false); opener.current?.focus(); };
    useEffect(() => {
        if (popup) dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }, [popup]);

    const deleteItem = async () => {
        if (deletingRef.current || !operation.acquire()) return;
        deletingRef.current = true;
        setDeleting(true);

        try {
            await fetchDeleteDraftItem(id);

            toast.success("下書き商品を削除しました");
            setPopup(false);
            await sleep(1500);

            router.push("/my-page");
        } catch (err) {
            deletingRef.current = false;
            setDeleting(false);
            operation.release();
            if (err instanceof ApiError) {
                toast.error("下書き商品の削除に失敗しました");
                setPopup(false);

                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
            setPopup(false);
        }
    };

    return (
        <>
            <button type="button" ref={opener} className={styles.deleteText} disabled={operation.busy} onClick={() => setPopup(true)}>
                この下書き商品を削除する
            </button>

            {popup && (
                <>
                    <div className={styles.overlay} onClick={close} />

                    <div className={styles.popup} ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") { event.preventDefault(); close(); }
                            if (event.key === "Tab") {
                                const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
                                const first = buttons[0];
                                const last = buttons[buttons.length - 1];
                                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                                if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
                            }
                        }}>
                        <button type="button" aria-label="閉じる" className={styles.x} onClick={close}><X size={20} /></button>

                        <p id={titleId} className={styles.popupTitle}>確認</p>
                        <p className={styles.text13}>※ 本当にこの下書き商品を削除しますか？</p>

                        <button type="button" className={styles.popupButton} onClick={deleteItem} disabled={deleting}>
                            削除する
                        </button>
                    </div>
                </>
            )}
        </>
    );
};
