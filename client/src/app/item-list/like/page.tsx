import { Metadata } from "next";
import ItemListUI from "../itemListUI";
import { LikedItemList } from "./likedItemList";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "いいね商品一覧",
        description: "いいねした商品の一覧をご覧いただけます。",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page() {
    return (
        <ItemListUI title="いいねした商品">
            <LikedItemList />
        </ItemListUI>
    );
}
