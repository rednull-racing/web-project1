import { Item } from "../types/types";
import { Button } from "./button";
import { ItemHighlight } from "./itemHighlight";
import { OkText } from "./okText";
import OkUI from "./okUI";

type Props = {
    itemId: string;
    item: Item;
};

export const OkPage = ({ itemId, item }: Props) => {
    return (
        <OkUI title="出品が完了しました">
            <ItemHighlight itemId={itemId} item={item} />
            <OkText name={item.name ?? ""} />

            <Button itemId={itemId} />
        </OkUI>
    );
};
