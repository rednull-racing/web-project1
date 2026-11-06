import { ChildrenLink, MypageLinkHeader, NormalLink, NormalLinkContainer } from "@/components/link";
import Link from "next/link";
import { SITE } from "../../config/site";
import styles from "./mypage.module.css";
import { ReferenceCode } from "./referenceCode";
import { Res, User } from "./types";

type Props = {
    user: User;
    data: Res;
    profileLink: string;
};

export const LinkSection = ({ user, data, profileLink }: Props) => {
    return (
        <>
            <MypageLinkHeader text="アカウント" />
            <NormalLinkContainer>
                <NormalLink url={profileLink} text="プロフィール" />
                <NormalLink url="/edit/profile" text="プロフィール設定" />
                <NormalLink url="/link/edit/personal" text="個人情報設定" />
                {!data.userData.hasShop && (
                    <>
                        <NormalLink url="/edit/account" text="振込口座設定" />
                        <NormalLink url="/shop-signup/step1" text="ショップ登録" />
                        {!user.honnin_verified && (
                            <ChildrenLink url="/edit/honnin">
                                本人確認 <span className={styles.red}>※{SITE.honninPointCampaign}ptプレゼント中</span>
                            </ChildrenLink>
                        )}
                    </>
                )}
                <ReferenceCode itemCount={data.itemCount} referenceCount={data.referenceCount} />
                <Link href="/notification" className={styles.linkElem}>
                    <p>お知らせ</p>
                    {data.unreadCount >= 1 && (
                        <div className={styles.unreadDiv}>
                            <svg width={18} height={18} className={styles.unreadIcon}>
                                <circle cx={9} cy={9} r={9} />
                            </svg>
                            {data.unreadCount < 100 ? (
                                <small className={styles.count}>{data.unreadCount}</small>
                            ) : (
                                <small className={styles.count}>99+</small>
                            )}
                        </div>
                    )}
                </Link>
            </NormalLinkContainer>

            <MypageLinkHeader text="商品リスト" />
            <NormalLinkContainer>
                <NormalLink url="/item-list/cart" text="カート" />
                <NormalLink url="/item-list/like" text="高評価リスト" />
                <NormalLink url="/order/list/purchased" text="購入した商品" />
                <NormalLink url="/item-list/uploaded" text="出品した商品" />
                {data.soldItemCount > 0 && <NormalLink url="/order/list/sold" text="売却済み商品" />}
                <NormalLink url="/item-list/trash" text="削除した商品" />
                <NormalLink url="/item-list/draft" text="下書き保存" />
            </NormalLinkContainer>

            {data.userData.hasShop && (
                <>
                    <MypageLinkHeader text={SITE.shopName} />
                    <NormalLinkContainer>
                        <NormalLink url="/money-management" text="売上管理（売上データの確認）" />
                        <NormalLink url="/item-list/stock" text="在庫管理" />
                        <NormalLink url="/shop-info" text="ショップ情報" />
                        <NormalLink url="/link/edit/shop" text="ショップ情報設定" />
                    </NormalLinkContainer>
                </>
            )}

            <MypageLinkHeader text="振込・お支払い" />
            <NormalLinkContainer>
                <NormalLink url="/edit/account/transfer" text="振込申請" />
                <NormalLink url="/transfer/history" text="振込申請履歴" />
                <NormalLink url="/transfer/points" text="ポイント変換" />
                <NormalLink url="/history/points" text="ポイント履歴" />
                <NormalLink url="/history/uriagekin" text="売上金履歴" />
            </NormalLinkContainer>

            <MypageLinkHeader text={`${SITE.appName}について`} />
            <NormalLinkContainer>
                <NormalLink url="/guide" text="使い方ガイド" />
                <NormalLink url="/terms-and-conditions" text="利用規約" />
                <NormalLink url="/privacy-policy" text="プライバシーポリシー" />
                <NormalLink url="/tokutei/link" text="特定商取引法に基づく表記" />
                <NormalLink url="/company" text="会社概要" />
                <NormalLink url="/inquiry" text="お問い合わせ" />
            </NormalLinkContainer>
        </>
    );
};
