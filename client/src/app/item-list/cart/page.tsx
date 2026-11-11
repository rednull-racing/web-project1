import { Metadata } from "next";
import ItemListUI from "../itemListUI";
import { fetchRecommend } from "./api/server";
import { CartList } from "./cartList";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "カート",
        description: "カートに追加した商品をご覧いただけます。",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page() {
    const data = await fetchRecommend();

    return (
        <ItemListUI title="カート">
            <CartList relatedItemList={data.items} />
        </ItemListUI>
    );
}
