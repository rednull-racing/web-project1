import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// jsdomはtop layerを実装しない。背景のinertと実focus制御はPlaywrightで検証する。
const names = ["showModal", "close"] as const;
const original = names.map((name) => Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name));
beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
        configurable: true,
        value(this: HTMLDialogElement) {
            this.setAttribute("open", "");
        },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
        configurable: true,
        value(this: HTMLDialogElement) {
            this.removeAttribute("open");
        },
    });
});
afterEach(() => {
    cleanup();
    names.forEach((name, index) => {
        const descriptor = original[index];
        if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
        else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    });
});
