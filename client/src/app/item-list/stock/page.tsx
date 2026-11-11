import { Metadata } from "next";
import { StockItemList } from "./stockItemList";
import ItemListUI from "../itemListUI";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "在庫一覧",
        description: "出品した商品の在庫を確認できます。",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page() {
    return (
        <ItemListUI title="在庫一覧">
            <StockItemList />
        </ItemListUI>
    );
}
