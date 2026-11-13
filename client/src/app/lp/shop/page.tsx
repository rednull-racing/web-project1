import { authOptions } from "@/lib/auth";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { SITE } from "../../../config/site";
import { fetchGetHasShop, fetchLpVideoList } from "../api/server";
import { Lp } from "../lp";

export const metadata: Metadata = {
    title: SITE.appName,
    description: `自慢のギアを動画で自慢！全く新しいアウトドア専門フリマ「${SITE.appName}」。${SITE.shopName}を開店して、圧倒的な面白さと信頼性でギアの販売を加速させませんか？`,
    robots: {
        index: false,
        follow: false,
    },
};

export default async function Page() {
    const session = await getServerSession(authOptions);
    const loggedIn = !!session?.user;

    const data = await fetchLpVideoList();

    const hasShopData = await fetchGetHasShop();

    return <Lp shopPage hasShop={hasShopData.hasShop} itemList={data} loggedIn={loggedIn} />;
}
