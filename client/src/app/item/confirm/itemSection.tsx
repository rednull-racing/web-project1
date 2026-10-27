import CStyles from "../itemCommon.module.css";
import { CategoryText } from "../itemSection/categoryText";
import { DeliverySection } from "../itemSection/deliverySection";
import { Detail } from "../itemSection/detail";
import { ItemHeader } from "../itemSection/itemHeader";
import { Slideshow } from "../itemSection/slideshow";
import { VariantsList } from "../itemSection/variantsList";
import { ItemEditing } from "./types";

type Props = {
    itemEditing: ItemEditing;
    soldout: boolean;
};

export const ItemSection = ({ itemEditing, soldout }: Props) => {
    const variants = itemEditing.attributes.colorVariants;

    return (
        <section className={CStyles.itemSection}>
            <Slideshow images={itemEditing.image_url} />
            <ItemHeader
                data={{
                    itemName: itemEditing.name,
                    price: itemEditing.price,
                    genderType: itemEditing.gender_type,
                    ageType: itemEditing.age_type,
                    recommend: itemEditing.recommend,
                    soldout,
                    saleFlag: itemEditing.sale_flag,
                    beforePrice: itemEditing.before_price,
                    discountRate: itemEditing.discount_rate ?? 0,
                    discountAmount: itemEditing.discount_amount ?? 0,
                }}
                page="confirm"
            />
            {variants && variants.length > 0 && <VariantsList itemAttributes={itemEditing.attributes} />}
            <Detail
                data={{
                    itemId: null,
                    detail: itemEditing.detail ?? "",
                    soldout,
                }}
            />
            <CategoryText categoryName={itemEditing.Category?.name ?? ""} />
            <DeliverySection
                data={{
                    itemAttributes: itemEditing.attributes,
                    condition: itemEditing.ItemConditionOption?.name ?? "-",
                    shippingService: itemEditing.ShippingServiceOption?.name ?? "-",
                    shippingPlace: itemEditing.TodouhukenOption?.name ?? "-",
                    shippingDay: itemEditing.ShippingDayOption?.name ?? "-",
                }}
            />
        </section>
    );
};
