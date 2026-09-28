import { NormalLink, NormalLinkContainer } from "@/components/link";

export const LinkSection = () => {
    return (
        <NormalLinkContainer>
            <NormalLink url="/edit/address" text="住所" />
            <NormalLink url="/edit/name" text="氏名" />
            <NormalLink url="/edit/phone-number" text="電話番号" />
            <NormalLink url="/edit/email" text="メールアドレス" />
            <NormalLink url="/edit/password" text="パスワード" />
            <NormalLink url="/edit/account" text="振込口座" />
            <NormalLink url="/edit/id-card" text="身分証" />
        </NormalLinkContainer>
    );
};
