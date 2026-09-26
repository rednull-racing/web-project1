import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import useSWR from "swr";
import { Button, InputTitle } from "../../../components/inputForm";
import { ApiError } from "../../../lib/api/apiError";
import { apiFetch } from "../../../lib/api/client";
import { sleep } from "../../../lib/sleep";
import styles from "../edit.module.css";
import EditUI from "../editUI";
import { User } from "../type";

export const IdCardEditForm = () => {
    const { data } = useSWR<{ user: User }>("/user/id-card", apiFetch);
    const frontS3Metadata = data?.user.IdCard?.FrontIdCard;
    const rearS3Metadata = data?.user.IdCard?.RearIdCard;

    const frontImageUrl = frontS3Metadata ? `${process.env.NEXT_PUBLIC_API_URL}/user/files/${frontS3Metadata.id}` : "";

    const rearImageUrl = rearS3Metadata ? `${process.env.NEXT_PUBLIC_API_URL}/user/files/${rearS3Metadata.id}` : "";

    const [idCardFront, setIdCardFront] = useState<File>();
    const [idFrontPreview, setIdFrontPreview] = useState("");
    const [idFrontUpload, setIdFrontUpload] = useState<boolean>(false);
    const [idCardRear, setIdCardRear] = useState<File>();
    const [idRearPreview, setIdRearPreview] = useState("");
    const [idRearUpload, setIdRearUpload] = useState<boolean>(false);

    const router = useRouter();

    const idFrontRef = useRef<HTMLInputElement | null>(null);
    const idRearRef = useRef<HTMLInputElement | null>(null);

    const handleChangeFront = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setIdCardFront(selectedFile);
            setIdFrontPreview(URL.createObjectURL(selectedFile));
            setIdFrontUpload(true);
        }
    };

    const handleChangeRear = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setIdCardRear(selectedFile);
            setIdRearPreview(URL.createObjectURL(selectedFile));
            setIdRearUpload(true);
        }
    };

    const submit = async () => {
        const hasFrontFile = idFrontUpload && idCardFront instanceof File;
        const hasRearFile = idRearUpload && idCardRear instanceof File;

        const body = {
            frontIdCard: hasFrontFile ? idCardFront : undefined,
            rearIdCard: hasRearFile ? idCardRear : undefined,
        };

        if (!body.frontIdCard || !body.rearIdCard) {
            toast.error("未入力の必須項目があります");
            return;
        }

        try {
            toast.success("身分証画像を更新しました");
            await sleep(1500);

            router.push("/my-page");
        } catch (err) {
            if (err instanceof ApiError) {
                switch (err.code) {
                    case "S3_METADATA_NOT_FOUND":
                        toast.error("画像を選び直して、もう一度お試しください。");
                        break;
                    case "FRONT_URL_EMPTY":
                        toast.error("身分証（表面）がありません");
                        break;
                    case "REAR_URL_EMPTY":
                        toast.error("身分証（裏面）がありません");
                        break;
                    default:
                        toast.error("身分証画像の更新に失敗しました");
                }
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    return (
        <EditUI title="身分証変更">
            <div className={styles.imageInputDiv}>
                <InputTitle title="身分証（表面）" hissu />
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleChangeFront}
                    className={styles.imageInput}
                    placeholder="画像ファイルをアップロード"
                    ref={idFrontRef}
                />
                <Image
                    src={idFrontPreview || frontImageUrl || "/no-image(1x1).png"}
                    alt="身分証（表面）"
                    width={120}
                    height={120}
                    className={styles.preview}
                />

                <InputTitle title="身分証（裏面）" hissu />
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleChangeRear}
                    className={styles.imageInput}
                    placeholder="画像ファイルをアップロード"
                    ref={idRearRef}
                    required
                />
                <Image
                    src={idRearPreview || rearImageUrl || "/no-image(1x1).png"}
                    alt="身分証（裏面）"
                    width={120}
                    height={120}
                    className={styles.preview}
                />

                <p className={styles.centerSmall}>
                    ※顔写真付きのもの
                    <br />
                    ※顔写真と生年月日がわかる面を表にして撮影
                    <br />
                    ※表裏合わせて計2枚撮影
                </p>
            </div>

            <Button onClick={submit}>送信する</Button>
        </EditUI>
    );
};
