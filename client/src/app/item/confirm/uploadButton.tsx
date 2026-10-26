"use client";

import { TermsList } from "@/components/terms";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../../lib/api/apiError";
import { sleep } from "../../../lib/sleep";
import { fetchCreateItem, fetchEditItem } from "../api/confirm";
import styles from "./confirm.module.css";

type Props = {
    id: string;
    page: "normal" | "edit";
};

export const UploadButton = ({ id, page }: Props) => {
    const [popup, setPopup] = useState(false);
    const [check, setCheck] = useState(false);
    const router = useRouter();

    const upload = async () => {
        if (!check) {
            alert("利用規約に同意し、チェックしてください");
            return;
        }

        try {
            const data = await fetchCreateItem(id);

            toast.success("商品を出品しました");
            await sleep(1500);

            router.push(`/upload/ok/${data.itemId}`);
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("サーバーエラーが発生しました。通信状況を確認し、もう一度ボタンをクリックしてください");
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const edit = async () => {
        if (!check) {
            alert("利用規約に同意し、チェックしてください");
            return;
        }

        try {
            const data = await fetchEditItem(id);

            toast.success("商品情報を更新しました");
            await sleep(1500);

            router.push(`/item/${data.itemId}`);
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("サーバーエラーが発生しました。通信状況を確認し、もう一度ボタンをクリックしてください");
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const fetch = page === "normal" ? upload : edit;

    return (
        <>
            <button type="button" className={styles.uploadButton} onClick={() => setPopup(true)}>
                出品する
            </button>

            <Link href={`/upload/edit/${id}`} className={styles.editButton}>
                商品を編集する
            </Link>

            {popup && (
                <>
                    <div className={styles.overlay} onClick={() => setPopup(false)} />

                    <div className={styles.popup}>
                        <X className={styles.x} onClick={() => setPopup(false)} />

                        <p className={styles.popupTitle}>出品する</p>

                        <p className={styles.termsTitle}>動画・画像禁止事項</p>
                        <div className={styles.termsDiv}>
                            <TermsList
                                number={1}
                                fontSize="small"
                                text="第三者の権利（著作権、肖像権、名誉権、商標権、特許権、実用新案権、意匠権、プライバシー権、パブリシティ権等を含みますがこれに限られません）を侵害する内容を含むコンテンツ"
                            />
                            <TermsList
                                number={2}
                                fontSize="small"
                                text="景品表示法や薬機法等に反する内容を含むコンテンツ"
                            />
                            <TermsList number={3} fontSize="small" text="性的なコンテンツ" />
                            <TermsList
                                number={4}
                                fontSize="small"
                                text="社会通念上、不健全またはわいせつと認められるコンテンツ"
                            />
                            <TermsList
                                number={5}
                                fontSize="small"
                                text="飲酒、喫煙を未成年向けに推奨するコンテンツ等、青少年の保護育成上好ましくないコンテンツ"
                            />
                            <TermsList
                                number={6}
                                fontSize="small"
                                text="商品ページで出品する商品以外を販売・提供・宣伝・誘導するコンテンツ"
                            />
                            <TermsList
                                number={7}
                                fontSize="small"
                                text="商品ページでの説明と異なる条件を提示する内容のコンテンツ"
                            />
                            <TermsList
                                number={8}
                                fontSize="small"
                                text="他者を不快にさせたり、他者の迷惑となる行為を含むコンテンツ"
                            />
                            <TermsList number={9} fontSize="small" text="送金を受けることを目的とするコンテンツ" />
                            <TermsList
                                number={10}
                                fontSize="small"
                                text="動画自体の視聴による対価を得ようとするコンテンツ（歌唱、演奏、パフォーマンス等）"
                            />
                            <TermsList
                                number={11}
                                fontSize="small"
                                text="犯罪による収益の移転防止に関する法律第2条に定める犯罪による収益の移転その他不当な目的で行うコンテンツ"
                            />
                            <TermsList
                                number={12}
                                fontSize="small"
                                text="出品ページで出品する商品の宣伝以外を目的とする動画等、本サービスの提供する目的から逸脱したコンテンツ"
                            />
                            <TermsList
                                number={13}
                                fontSize="small"
                                text="本サービスの提供する購入者に提供するシステムを利用しない取引を誘引するコンテンツ"
                            />
                            <TermsList number={14} fontSize="small" text="盗品" />
                            <TermsList number={15} fontSize="small" text="その他法令等や公序良俗に反するコンテンツ" />
                        </div>

                        <p className={styles.termsTitle}>商品禁止事項</p>
                        <div className={styles.termsDiv}>
                            <TermsList number={1} fontSize="small" text="盗品、入手経路が不明瞭なもの" />
                            <TermsList number={2} fontSize="small" text="血液" />
                            <TermsList number={3} fontSize="small" text="生き物" />
                            <TermsList
                                number={4}
                                fontSize="small"
                                text="電子チケットや電子クーポン、QRコードなどの電子データ"
                            />
                            <TermsList
                                number={5}
                                fontSize="small"
                                text="新型コロナウイルスの影響に伴い、取引が禁止されている商品"
                            />
                            <TermsList number={6} fontSize="small" text="偽ブランド品" />
                            <TermsList number={7} fontSize="small" text="殺傷能力があり武器として使用されるもの" />
                            <TermsList
                                number={8}
                                fontSize="small"
                                text="モバイルバッテリーやカートリッジガスこんろ等、製品安全4法（消費生活用製品安全法、電気用品安全法、ガス事業法、液化石油ガスの保安の確保及び取引の適正化に関する法律）が指定する商品について、安全基準を満たす「PSマーク」がないもの"
                            />
                            <TermsList number={9} fontSize="small" text="出品時に手元にないもの" />
                            <TermsList
                                number={10}
                                fontSize="small"
                                text="生もの等衛生上管理が難しい食品類又は開封済みのもの"
                            />
                            <TermsList number={11} fontSize="small" text="酒、たばこ類" />
                            <TermsList number={12} fontSize="small" text="現金、金券、カード類" />
                            <TermsList number={13} fontSize="small" text="医薬品、医療機器" />
                            <TermsList number={14} fontSize="small" text="サービス・権利などの実体のないもの" />
                            <TermsList number={15} fontSize="small" text="領収証・公的証明書類" />
                            <TermsList number={16} fontSize="small" text="農薬、肥料" />
                            <TermsList number={17} fontSize="small" text="土地、建物、自動車" />
                            <TermsList number={18} fontSize="small" text="法令により所持や販売が禁止されている商品" />
                            <TermsList number={19} fontSize="small" text="規制薬物・危険ドラッグ類" />
                            <TermsList number={20} fontSize="small" text="放射性物質を含むおそれがあるもの" />
                            <TermsList
                                number={21}
                                fontSize="small"
                                text="アダルト関連商材、児童ポルノやそれに類するとみなされるもの"
                            />
                            <TermsList number={22} fontSize="small" text="使用済み下着、体操服、その他不衛生なもの" />
                            <TermsList number={23} fontSize="small" text="携帯端末やSIMカード" />
                            <TermsList number={24} fontSize="small" text="個人情報を含む商品、個人情報の不正利用" />
                            <TermsList
                                number={25}
                                fontSize="small"
                                text="レンタル品など、出品者への返送を必要とするもの"
                            />
                            <TermsList
                                number={26}
                                fontSize="small"
                                text="リコール製品のうち、改善対策済みではないもの"
                            />
                            <TermsList
                                number={27}
                                fontSize="small"
                                text="その他、法令違反している又はその可能性があるもの、弊社が不適切と判断するもの"
                            />
                        </div>

                        <label className={styles.checkLabel}>
                            <input
                                type="checkbox"
                                name="check"
                                checked={check}
                                onChange={() => setCheck(!check)}
                                className={styles.check}
                            />
                            <p className={styles.checkText}>この商品は利用規約を遵守しております。</p>
                        </label>

                        <button type="button" className={styles.popupButton} onClick={fetch}>
                            出品する
                        </button>
                    </div>
                </>
            )}
        </>
    );
};
