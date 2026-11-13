/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./stepBar.module.css";

export const StepBar = () => {
    const [width, setWidth] = useState(0);
    const pathname = usePathname();

    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const itemRef = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => setWidth(window.innerWidth));

        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);

        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;

        let startX = 0;
        let startY = 0;
        let startScroll = 0;
        let isDragging = false;
        const threshold = 8;

        function onTouchStart(e: TouchEvent) {
            const t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            startScroll = el!.scrollLeft;
            isDragging = false;
        }

        function onTouchMove(e: TouchEvent) {
            if (e.touches.length > 1) return;
            const t = e.touches[0];
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;

            if (!isDragging) {
                if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
                    isDragging = true;
                } else {
                    return;
                }
            }

            e.preventDefault();

            el!.scrollLeft = startScroll - dx;
        }

        function onTouchEnd() {
            isDragging = false;
        }

        el.addEventListener("touchstart", onTouchStart, { passive: true });
        el.addEventListener("touchmove", onTouchMove, { passive: false });
        el.addEventListener("touchend", onTouchEnd, { passive: true });

        return () => {
            el.removeEventListener("touchstart", onTouchStart as any);
            el.removeEventListener("touchmove", onTouchMove as any);
            el.removeEventListener("touchend", onTouchEnd as any);
        };
    }, []);

    const steps = useMemo(
        () => [
            { label: "事業者情報", path: "/shop-signup/step1", shortLabel: "事業者情報" },
            { label: "口座登録", path: "/shop-signup/step2", shortLabel: "口座登録" },
            { label: "身分証・証明書", path: "/shop-signup/step3", shortLabel: "身分証" },
            { label: "オプション", path: "/shop-signup/step4", shortLabel: "オプション" },
        ],
        [],
    );

    const activeIndex = steps.findIndex((s) => pathname.startsWith(s.path));

    useEffect(() => {
        const idx = steps.findIndex((s) => pathname.startsWith(s.path));
        if (idx === -1) return;

        const wrapper = wrapperRef.current;
        const activeItem = itemRef.current[activeIndex];

        if (!wrapper || !activeItem) return;

        const itemRect = activeItem.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();

        const offsetLeft = itemRect.left - wrapperRect.left;

        const targetScroll = offsetLeft + wrapper.scrollLeft - wrapper.clientWidth / 2 + itemRect.width / 2;

        wrapper.scrollTo({
            left: targetScroll,
            behavior: "smooth",
        });
    }, [activeIndex, width, pathname, steps]);

    return (
        <div className={styles.scrollWrapper} ref={wrapperRef}>
            <div className={styles.wrapper}>
                {steps.map((step, index) => {
                    const isActive = index === activeIndex;
                    const isCompleted = index < activeIndex;

                    return (
                        <div
                            key={index}
                            ref={(el) => {
                                itemRef.current[index] = el;
                            }}
                            className={styles.stepItem}
                        >
                            <div className={styles.stepInner}>
                                <div
                                    className={`${styles.circle} ${
                                        isActive ? styles.active : ""
                                    } ${isCompleted ? styles.completed : ""}`}
                                >
                                    {isCompleted ? "✓" : index + 1}
                                </div>

                                <span className={`${styles.label} ${isActive ? styles.labelActive : ""}`}>
                                    {width <= 480 ? step.shortLabel : step.label}
                                </span>
                            </div>

                            {index < steps.length - 1 && <div className={styles.line} />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
