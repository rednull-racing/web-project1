import { Metadata } from "next";
import { ItemList } from "../itemList";
import ItemListUI from "../itemListUI";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "削除した商品一覧",
        description: "最近1か月以内に削除した商品をご覧いただけます。",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page() {
    return (
        <ItemListUI title="削除した商品">
            <ItemList page="deleted" />
        </ItemListUI>
    );
}
