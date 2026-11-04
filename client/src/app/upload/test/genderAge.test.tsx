import { Profiler, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GenderAge, type GenderAgeValue } from "../genderAge";

describe("GenderAge", () => {
    it.each([
        { allowed_gender: "men" as const, allowed_age: "adult" as const },
        { allowed_gender: "women" as const, allowed_age: "kids" as const },
        { allowed_gender: "unisex" as const, allowed_age: "both" as const },
        null,
    ])("U10 制約%j反映後の更新が収束する", (constraint) => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        let commits = 0;
        function Host() {
            const [value, onChange] = useState<GenderAgeValue>({ gender_type: "unisex", age_type: "both" });
            return (
                <Profiler
                    id="gender"
                    onRender={() => {
                        // 非収束時もテストプロセスが停止できるようcommit回数を制限する。
                        if (++commits > 25) throw new Error("GenderAge updates did not settle after 25 commits");
                    }}
                >
                    <GenderAge value={value} onChange={onChange} categoryConstraint={constraint} />
                </Profiler>
            );
        }
        expect(() => render(<Host />)).not.toThrow();
        expect(
            screen.getByRole("radio", {
                name:
                    constraint?.allowed_gender === "men"
                        ? "メンズ"
                        : constraint?.allowed_gender === "women"
                          ? "レディース"
                          : "ユニセックス",
            }),
        ).toBeChecked();
    });
});

it("AF-F1 制約変更で対象を補正し解除後はラジオ操作できる", () => {
    const change = vi.fn();
    function Host({ constrained }: { constrained: boolean }) {
        const [value, set] = useState<GenderAgeValue>({ gender_type: "men", age_type: "adult" });
        return (
            <GenderAge
                value={value}
                onChange={(next) => {
                    change(next);
                    set(next);
                }}
                categoryConstraint={constrained ? { allowed_gender: "women", allowed_age: "kids" } : null}
            />
        );
    }
    const { rerender } = render(<Host constrained={false} />);
    rerender(<Host constrained />);
    expect(screen.getByRole("radio", { name: "レディース" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "キッズ向け" })).toBeChecked();
    rerender(<Host constrained={false} />);
    fireEvent.click(screen.getByRole("radio", { name: "メンズ" }));
    expect(change).toHaveBeenLastCalledWith({ gender_type: "men", age_type: "kids" });
});
