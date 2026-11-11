import { Metadata } from "next";
import ItemListUI from "../itemListUI";
import { DraftItemList } from "./draftItemList";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "下書き商品一覧",
        description: "下書き保存した商品をご覧いただけます。",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page() {
    return (
        <ItemListUI title="下書き商品">
            <DraftItemList />
        </ItemListUI>
    );
}
