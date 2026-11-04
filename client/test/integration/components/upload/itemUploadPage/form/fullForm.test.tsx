import "@/../test/fixtures/upload/itemUploadPage/baseSetup";
import { formProps } from "@/../test/fixtures/upload/itemUploadPage/fixtures";
import { Form } from "@/app/upload/form";
import { render, screen } from "@testing-library/react";
import { Profiler } from "react";
import { expect, it } from "vitest";

it("U10 C03 実GenderAgeを含むフォームの初期描画が収束する", () => {
    let commits = 0;
    // 無限更新でランナーが停止しないよう上限を設ける。成功条件を緩和するモックではない。
    render(<Profiler id="full-form" onRender={() => {
        if (++commits > 30) throw new Error("GenderAge初期描画が30commit以内に収束しません");
    }}><Form {...formProps()} /></Profiler>);
    expect(screen.getByRole("button", { name: "出品する" })).toBeEnabled();
});
