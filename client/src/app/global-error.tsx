"use client";

type Props = {
    error: Error & { digest?: string };
    reset: () => void;
};

export default function GlobalError({ reset }: Props) {
    return (
        <html lang="ja">
            <body>
                <div>
                    <h2>予期しないエラーが発生しました</h2>

                    <button onClick={() => reset()}>再読み込み</button>
                </div>
            </body>
        </html>
    );
}
