import { PurchaseSnapshot } from "@/types/purchaseSnapshot";

export type DeliveryStatusOption = {
    id: string;
    name: string;
};

export type Delivery = {
    id: string;
    DeliveryStatusOption: DeliveryStatusOption | null;
};

export type Orders = {
    id: string;
    total_amount: number;
    point_used: number;
    item_count: number;
    buy_at: Date;
    status: "pending" | "paid" | "shipped" | "completed" | "cancelled" | "returned";
    purchase_snapshot: PurchaseSnapshot;
    Delivery: Delivery | null;
};
