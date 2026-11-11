import { Metadata } from "next";
import ItemListUI from "../itemListUI";
import { WatchHistoryList } from "./watchHistoryList";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "閲覧履歴",
        description: "閲覧した商品の一覧をご覧いただけます。",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page() {
    return (
        <ItemListUI title="閲覧した商品">
            <WatchHistoryList />
        </ItemListUI>
    );
}
