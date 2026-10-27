import CStyles from "../itemCommon.module.css";
import { CategoryText } from "../itemSection/categoryText";
import { DeliverySection } from "../itemSection/deliverySection";
import { Detail } from "../itemSection/detail";
import { ItemHeader } from "../itemSection/itemHeader";
import { Slideshow } from "../itemSection/slideshow";
import { VariantsList } from "../itemSection/variantsList";
import { ItemDraft } from "./types";

type Props = {
    itemDraft: ItemDraft;
    soldout: boolean;
};

export const ItemSection = ({ itemDraft, soldout }: Props) => {
    const variants = itemDraft.attributes.colorVariants?.map((variant) => ({
        ...variant,
        image_url: variant.image_url || "/no-image(1x1).png",
    }));
    const images = itemDraft.image_url?.filter((url) => url) ?? [];

    return (
        <section className={CStyles.itemSection}>
            <Slideshow images={images.length > 0 ? images : ["/no-image(1x1).png"]} />
            <ItemHeader
                data={{
                    itemName: itemDraft.name || "商品名未入力",
                    price: itemDraft.price ?? "-",
                    genderType: itemDraft.gender_type,
                    ageType: itemDraft.age_type,
                    recommend: itemDraft.recommend ?? false,
                    soldout,
                    saleFlag: itemDraft.sale_flag,
                    beforePrice: itemDraft.before_price ?? 0,
                    discountRate: itemDraft.discount_rate ?? 0,
                    discountAmount: itemDraft.discount_amount ?? 0,
                }}
                page="draft"
            />
            {variants && variants.length > 0 && (
                <VariantsList itemAttributes={{ ...itemDraft.attributes, colorVariants: variants }} />
            )}
            <Detail
                normalPage={false}
                data={{
                    itemId: null,
                    detail: itemDraft.detail ?? "",
                    soldout,
                }}
            />
            <CategoryText categoryName={itemDraft.Category?.name ?? ""} />
            <DeliverySection
                data={{
                    itemAttributes: itemDraft.attributes,
                    condition: itemDraft.ItemConditionOption?.name ?? "-",
                    shippingService:
                        itemDraft.shipping_service_free_text || itemDraft.ShippingServiceOption?.name || "-",
                    shippingPlace: itemDraft.TodouhukenOption?.name ?? "-",
                    shippingDay: itemDraft.ShippingDayOption?.name ?? "-",
                }}
            />
        </section>
    );
};
