"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import styles from "./slide.module.css";

type Props = {
    images: string[];
};

export const Slideshow = ({ images }: Props) => {
    const [modalSrc, setModalSrc] = useState<string | null>(null);

    const triggerRef = useRef<HTMLElement | null>(null);

    return (
        <>
            <Swiper
                modules={[Navigation, Pagination, Autoplay]}
                loop
                autoplay={{ delay: 5000, disableOnInteraction: false }}
                pagination={{ clickable: true }}
                observer={true}
                observeParents={true}
                className={styles.slider}
            >
                {images.map((src, i) => (
                    <SwiperSlide key={i}>
                        <div className={styles.sliderImage} role="button" tabIndex={modalSrc ? -1 : 0}
                            aria-label={`画像${i + 1}を拡大`}
                            onClick={(event) => { triggerRef.current = event.currentTarget; setModalSrc(src); }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    triggerRef.current = event.currentTarget;
                                    setModalSrc(src);
                                }
                            }}>
                            <Image
                                src={src}
                                alt={`Slide ${i + 1}`}
                                fill
                                style={{ objectFit: "cover" }}
                                className={styles.image}
                            />
                        </div>
                    </SwiperSlide>
                ))}
            </Swiper>

            {modalSrc && (
                <div className={styles.overlay}>
                    <button type="button" aria-label="拡大画像を閉じる" className={styles.x} onClick={() => {
                        setModalSrc(null);
                        triggerRef.current?.focus();
                    }}><X /></button>

                    <Swiper
                        modules={[Navigation, Pagination]}
                        loop={false}
                        pagination={{ clickable: true }}
                        navigation={{ enabled: true }}
                        initialSlide={images.indexOf(modalSrc)}
                        className={styles.sliderModal}
                    >
                        {images.map((src, i) => (
                            <SwiperSlide key={i}>
                                <div className={styles.sliderImageModal}>
                                    <Image
                                        src={src}
                                        alt={`全画面スライド ${i + 1}`}
                                        fill
                                        className={styles.imageModal}
                                    />
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>
            )}
        </>
    );
};
