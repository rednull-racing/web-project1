"use client";

import { Rating, Star as RatingStar } from "@smastrom/react-rating";
import "@smastrom/react-rating/style.css";
import { useEffect, useState } from "react";
import { fetchStar } from "./api/star";

type Props = {
    userId: string;
};

export const Star = ({ userId }: Props) => {
    const [star, setStar] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await fetchStar(userId);
                setStar(data.user.star_average || 0);
            } catch {}
        };

        fetchData();
    }, [userId]);

    return (
        <Rating
            style={{ maxWidth: 80 }}
            value={star}
            readOnly
            itemStyles={{
                itemShapes: RatingStar,
                activeFillColor: "#facc15",
                inactiveFillColor: "#d5d7dc",
            }}
        />
    );
};
