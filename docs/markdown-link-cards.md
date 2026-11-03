# Markdown のリンクカード（Sätteri プラグイン）

記事の段落に URL だけを置くと、リンク先の OG メタデータ（タイトル・説明・サムネイル・favicon）を表示するカードになります。現在は `remark-link-card-plus`（unified）で表示しており、このドキュメントはその置き換えとなるリポジトリ内の Sätteri プラグインについて説明します。

> [!NOTE]
> このプラグインはまだ Astro に組み込んでいません。Markdown 処理を Sätteri へ切り替えるとき（#766）に組み込みます。それまでの本番表示は `remark-link-card-plus` と `src/styles/remark-link-card.css` のままです。

## ファイル

| ファイル                                  | 役割                                                         |
| ----------------------------------------- | ------------------------------------------------------------ |
| `src/lib/markdown/link-card.ts`           | mdast プラグイン本体（対象段落の判定、カードの HTML、取得の束ね） |
| `src/lib/markdown/link-card-metadata.ts`  | ページの取得と OG メタデータの解析                           |
| `src/lib/markdown/link-card-image.ts`     | favicon・サムネイル画像の保存                                |
| `src/styles/link-card.css`                | カードのスタイル（`remark-link-card.css` のクラス名を変えたもの） |
| `src/lib/markdown/link-card*.test.ts`     | 外部通信をモックした単体テスト                               |

## 使い方

```typescript
import { linkCard } from '@lib/markdown/link-card';
import { markdownToHtml } from 'satteri';

const { html } = await markdownToHtml(source, { mdastPlugins: [linkCard()] });
```

`linkCard()` のオプションはすべて省略できます（テストでは `fetch` と `imageDirectory` を差し替えます）。

| オプション        | 既定値                                  | 説明                                   |
| ----------------- | --------------------------------------- | -------------------------------------- |
| `fetch`           | `globalThis.fetch`                      | 外部取得に使う fetch                   |
| `timeout`         | `10000`                                 | 1 リクエストのタイムアウト（ミリ秒）   |
| `concurrency`     | `6`                                     | 同時に行う外部リクエストの上限         |
| `imageDirectory`  | `<cwd>/public/link-card-images`         | 画像の保存先                           |
| `imagePublicPath` | `/link-card-images/`                    | 保存した画像をページから参照するパス   |

## カードになる段落

旧プラグインと同じ条件です。

- ルート直下の段落で、子が 1 つだけのもの（リスト・引用の中や、前後に文字がある段落は通常のリンクのまま）
- その中身が次のどれか
  - 裸の URL（GFM の自動リンク）: `https://example.com/`
  - 山括弧の自動リンク: `<https://example.com/>`
  - リンク文字列とリンク先が同じ URL のリンク: `[https://example.com/](https://example.com/)`
  - URL だけのテキスト（`http(s)://` で始まり空白を含まないもの）
- `[https://a.example/](https://b.example/)` のように文字列とリンク先が違うリンクは対象外

## OG メタデータの取得（ビルド時）

Sätteri の visitor は Promise を返せ、`markdownToHtml` は非同期プラグインがあると Promise を返します。Astro（`@astrojs/markdown-satteri`）も `markdownToHtml` の結果を await するため、**事前取得の仕組みは作らず、`paragraph` visitor の中で直接 await しています。** Sätteri は 1 文書の中の非同期 visitor を並行に実行するので、カードが多い記事でも順番待ちにはなりません。

- 取得には `globalThis.fetch` を使います。E2E のビルド（`pnpm run build:e2e`）では `tests/e2e/support/network-stub.ts` がこれを捕捉し、合成レスポンスに置き換えます。スタブが返した画像は、ビルド終了時に `public/link-card-images/` からも削除されます。
- 同じ URL のカードは、プラグインのインスタンス（= 1 回のビルド）の中で 1 回だけ取得します。
- 外部リクエストは同時に 6 件まで、1 件あたり 10 秒でタイムアウトします。
- HTML の解析には Sätteri の `htmlToHast` を使います（HTML エンティティもパーサーが展開します）。文字コードは `<meta charset>` → `<meta http-equiv="content-type">` → `Content-Type` ヘッダーの順に決め、Shift_JIS などのページも読めます。

取り出す項目と優先順位は、旧プラグインが使う `open-graph-scraper` のうち、表示に効くものに合わせています。

| 項目     | 優先順位                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| タイトル | `og:title` → `<title>` → `<meta name="title">` → ホスト名                                                    |
| 説明     | `og:description` → `<meta name="description">` → `<meta itemprop="description">` → 空                        |
| 画像     | `og:image:secure_url` → `og:image` → `og:image:url`（GIF と大きい画像を優先）→ og:image がなければ本文の最初の絶対 URL の画像 |
| favicon  | `<link rel="shortcut icon">` → `icon` → `mask-icon` → `apple-touch-icon` → `type="image/png"` など → Google の favicon サービス |

- favicon の相対 URL はページのオリジンを基準に解決します（旧プラグインと同じ）。
- 相対 URL の og:image は使いません（旧プラグインも表示していないため）。
- `http(s)` 以外の URL（`javascript:`、`data:` など）は画像として使いません。

## 取得に失敗したとき

HTTP エラー、タイムアウト、ネットワークエラー、HTML ではない応答（`Content-Type` が `text/` 以外、PDF などの拡張子）、OG タグのないページでも、ビルドは止めずにカードの形を保ちます。

- タイトルはホスト名、説明は空（要素は残すので高さは変わらない）、サムネイルなし
- favicon はページから取れなければ Google の favicon サービスを試し、それも取れなければ表示しない
- `[link-card]` で始まる警告を `console.warn` に出す

## 画像（favicon・サムネイル）の扱い

旧プラグインの `cache: true` と同じく、**ビルド時にダウンロードして `public/` 配下に保存し、ローカルのパスで参照します。** 画像は加工せず、取得したバイト列をそのまま保存します（表示サイズは HTML の `width` / `height` と CSS で決まるため、見た目は旧プラグインと同じになります）。

- 保存先: `public/link-card-images/`（gitignore 済み）。参照パスは `/link-card-images/<ファイル名>`
  - 旧プラグインの `public/remark-link-card-plus/` から、プラグイン名に依存しない名前に変えました
- ファイル名: 画像 URL を `decodeURI` した文字列の SHA-256 + 拡張子（旧プラグインと同じ規則なので、E2E スタブの後片付けも同じ考え方で扱える）
- 拡張子: SVG は `Content-Type`、それ以外は先頭バイト（PNG / JPEG / GIF / WebP / AVIF / ICO / BMP）で判定し、判定できない `image/*` は `.png`
- 同じファイル名の画像が保存済みなら再ダウンロードしない
- 保存できなかった画像（HTTP エラー、画像ではない応答など）は、旧プラグインと同じく元の URL を直接参照する（Google の favicon サービスだけは、取れなければ favicon なしにする）

ビルドのたびに `public/` へ書き出す方式は旧プラグインと同じです。CI では毎回空の状態から取得します。

## 旧プラグインとの差分

表示を変えないことを目標にしており、生成する HTML の構造は旧プラグインと同じです（クラス名の接頭辞だけが `remark-link-card-plus__` から `link-card__` に変わります）。

OG のタイトル・説明は、旧プラグインと同じく `sanitize-html` の既定の設定で無害化します（`sanitizeText()`）。旧プラグインと同じ結果になるため、OG の文字列にタグが含まれていても表示は変わりません。

- 許可されていないタグはタグだけを取り除き、中の文字列は残す（例: `Using <tag> in X` → `Using  in X`）
- `<script>` / `<style>` などは中身ごと取り除く
- `<b>` / `<a>` などの許可されたタグは、`on*` 属性や `javascript:` の URL を外して残す
- タグでない `&` / `<` / `>` はエスケープする

URL・画像パス・ホスト名は属性値・本文としてすべてエスケープします。

意図的な差分は次のとおりです（いずれも取得に失敗したときなどの例外的な場合だけで、通常の表示には影響しません）。

- 取得の途中で例外が起きても、カード自体は必ず出力します（旧プラグインは Google favicon の確認で例外が起きると、その段落を通常のリンクのまま残していました）。
- 保存に失敗した画像（404 など）をローカルに書き出しません（旧プラグインは応答本文を拡張子なしで保存し、壊れた画像を参照していました）。
- 取得前の公開 IP アドレスの確認（`open-graph-scraper` の SSRF 対策）は行いません。取得先は記事の筆者が書いた URL だけなので、ビルド時の用途では不要と判断しました。

## Astro への組み込み（#766 で行うこと）

- `astro.config.mjs` の Sätteri の `mdastPlugins` に `linkCard()` を追加する
- `src/styles/global.css` の `@import './remark-link-card.css';` を `@import './link-card.css';` に置き換え、`remark-link-card.css` を削除する（`link-card.css` は `@apply` を使うため、`global.css` から読み込む必要がある）
- `tests/e2e/support/network-stub.ts` の後片付け対象から `public/remark-link-card-plus/` を外す（`public/link-card-images/` は対象に追加済み）
- `remark-link-card-plus` と、`.gitignore` の `public/remark-link-card-plus/` を削除する
- 切り替えの前後で、E2E ビルド（ネットワークスタブあり）のページ全体の表示が変わらないことを確かめる
