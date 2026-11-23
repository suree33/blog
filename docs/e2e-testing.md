# E2E テスト (Playwright)

このドキュメントでは、Playwright を使った E2E テストの構成、実行コマンド、CI での動かし方をまとめます。

## 概要

Astro のビルド結果を `astro preview` で起動し、スモークテスト、axe-core アクセシビリティ検査、ナビゲーション、タグページ、テーマ切り替え、404 ページ、ビジュアルリグレッションを検証します。主なブラウザ UI spec はデスクトップ（Chromium / Firefox / WebKit）とモバイル（Mobile Chrome / Mobile Safari / Mobile Safari (Small screen)）の 6 プロジェクトで実行し、axe-core アクセシビリティ検査と RSS フィードテストは `chromium` / `Mobile Chrome` の 2 プロジェクトで実行します。ページ全体のビジュアルリグレッションは `chromium`（ライト / ダーク）と `Mobile Chrome`（ライト）で実行します。

テストコードは Playwright の fixture とページオブジェクトモデル (POM) で構成しています。アサーションは spec に置き、POM はページ遷移や安定したロケーターの提供に限定します。

## コマンド

Markdown の全記事描画と生成 HTML の回帰検証は [Vitest ユニットテスト](./unit-testing.md) で実行します。

Run `pnpm run test:e2e tests/e2e/specs/rss.spec.ts --project=chromium` to verify the built RSS XML. The expected set mirrors `src/content.config.ts` and `src/lib/posts.ts`: top-level `src/content/posts/*.md` entries with `draft !== true`, plus top-level `src/pages/*.md` pages with `draft !== true`, title, and pubDate. E2E fixture posts are also read and filtered by draft. Tests cover exact item membership, every item's content and publication date, sanitized HTML, preserved headings/paragraphs/links/code/images, and the XSL processing instruction and response. Dates use Astro's `astro/markdown` frontmatter parser and the collection schema's date normalization before UTC comparison. Markdown images must use same-origin URLs and resolve through preview with HTTP 200 and an image content-type; link-card images are identified from the built article's `.link-card__container` and checked for valid absolute HTTP(S) URLs only, since failed caching can leave external image URLs. The configured renderer uses the Sätteri link-card plugin in `src/lib/markdown/link-card.ts`. Both RSS content paths allow images and convert their sources to absolute URLs, following the [Astro RSS documentation](https://docs.astro.build/en/recipes/rss/).

- `pnpm run test:e2e`: ヘッドレスで全 E2E テストを実行
- `pnpm run test:worker`: Worker の公開 HTTP レスポンス境界を Node.js Test Runner で検証
- `pnpm run test:e2e:headed`: ブラウザを表示して実行
- `pnpm run test:e2e:ui`: Playwright UI モードで実行
- `pnpm run test:e2e:update`: コンポーネントのビジュアルスナップショットを更新
- `pnpm run test:e2e:visual`: 全ページのフルページ比較（専用 Linux コンテナで実行）
- `pnpm run test:e2e:visual:update`: フルページのベースラインを更新

初回実行前にブラウザが必要です。未インストールの場合は以下を実行してください（config が Chromium / Firefox / WebKit を使うため 3 種すべて）。

```sh
pnpm exec playwright install chromium firefox webkit
```

Linux 環境でブラウザのシステム依存パッケージも入れる場合は、次のコマンドを使います。

```sh
pnpm exec playwright install --with-deps chromium firefox webkit
```

Collection entries are compiled with [`render()`](https://docs.astro.build/en/reference/modules/astro-content/#render) and rendered to HTML with the [Container API's `renderToString()`](https://docs.astro.build/en/reference/container-reference/#rendertostring) before sanitization. This resolves Astro image references to real asset URLs; reading `entry.rendered.html` directly leaves unresolved image placeholders. Standalone pages continue to use `compiledContent()`.

## ディレクトリ構成

```
playwright.config.ts          # Playwright 設定
tests/e2e/
├── components/               # UI 部品単位のロケーター
│   ├── header.ts             # <header> (banner)
│   ├── footer.ts             # <footer> (contentinfo)
│   ├── post-list.ts          # ホームの記事一覧
│   ├── post-metadata.ts      # 記事メタデータ
│   └── toc.ts                # 目次 (TOC)
├── pages/                    # ページオブジェクト
│   ├── home-page.ts          # ホーム (/)
│   ├── about-page.ts         # About (/about)
│   ├── article-page.ts       # 記事ページ
│   ├── tag-page.ts           # タグページ (/tags/[tag])
│   ├── rss-feed-page.ts      # RSS フィード (/rss.xml)
│   └── not-found-page.ts     # 404 ページ
├── fixtures/
│   └── test.ts               # 共通 fixture
├── utils/
│   ├── routes.ts             # テストで使うルート定義
│   ├── site-pages.ts         # ページ全体 VRT の撮影対象（記事・タグをソースから列挙）
│   └── regex.ts              # 正規表現ユーティリティ
├── support/
│   └── network-stub.ts       # E2E ビルド用のネットワークスタブ（--import プリロード）
├── styles/
│   ├── screenshot.css        # スクリーンショット用の固定スタイル
│   └── screenshot-pages.css  # ページ全体 VRT 用の固定スタイル（等幅フォントを維持）
└── specs/
    ├── smoke.spec.ts         # 基本表示の確認
    ├── accessibility.spec.ts # axe-coreアクセシビリティ検査
    ├── article-layout.spec.ts # 記事本文のレスポンシブ幅と目次ガター
    ├── canonical-links.spec.ts # 内部リンクの末尾スラッシュ統一とリダイレクトなしの HTTP 200
    ├── datetime.spec.ts      # 公開日・更新日の datetime 属性と frontmatter の一致
    ├── drafts.spec.ts        # 下書きの一覧・フィードからの除外と非公開 URL の 404
    ├── link-card-geometry.spec.ts # リンクカードの幅・内在サイズと余白の回帰検証
    ├── metadata.spec.ts      # OGP と説明文の確認
    ├── navigation.spec.ts    # ヘッダー/フッターの遷移確認
    ├── tag.spec.ts           # タグページ (/tags/[tag]) の確認
    ├── theme.spec.ts         # テーマ切り替えの確認
    ├── toc.spec.ts           # 目次 (TOC) の表示・追従
    ├── not-found.spec.ts     # 404 ページの確認
    ├── reduced-motion.spec.ts # モーション設定に応じたスクロールとモバイルメニュー
    ├── sitemap.spec.ts       # サイトマップの掲載 URL・HTTP 200 と robots.txt の案内
    ├── visual.spec.ts        # ビジュアルリグレッション（コンポーネント単位）
    ├── visual-pages.spec.ts  # ビジュアルリグレッション（全ページ・フルページ）
    ├── rss.spec.ts           # RSS フィードの確認
    └── raw-markdown.spec.ts  # raw Markdown エンドポイント
```

ビジュアルスナップショットは `tests/e2e/specs/<spec ファイル名>-snapshots/` に保存します。通常のコンポーネント比較は OS サフィックスなし（例: `article-metadata-chromium.png`）、フルページ比較は OS サフィックス付き（例: `home-light-chromium-linux.png`）です。

## `playwright.config.ts` の要点

- `testDir`: `./tests/e2e/specs` を指定し、spec ファイルだけをテスト対象にします。
- `webServer`: 通常は `E2E_DRAFT_FIXTURE=true build:ci`、フルページ専用の `playwright.visual.config.ts` は `build:e2e` でビルド後、`pnpm run preview --port 4322` を起動します。専用 config は既存サーバーを再利用しません。通常の開発サーバーが使う `4321` とは競合しません。
- `build:e2e`: `prebuild`（`pnpm lint`）を経由しない `astro build` を、`E2E_DRAFT_FIXTURE=true`、`TZ=UTC` と `NODE_OPTIONS=--import ./tests/e2e/support/network-stub.ts` 付きで実行します。ビルド時の外部 HTTP をスタブに置き換えるためです（後述の「ページ全体のビジュアルリグレッション」を参照）。本番用の `build` / `build:ci` は変更しません。
- `reporter`: 通常は `list` で標準出力に進行を出し、`html` で `playwright-report/` を生成します。GitHub Actions 上では `github` reporter も追加し、失敗箇所を Actions の annotation として表示します。
- `fullyParallel`: spec 内のテストも並列化します。`workers` は常に `undefined` とし、Playwright のデフォルト（論理 CPU コア数の半分）に任せます。
- `projects`: デスクトップ 3 種（`chromium` / `firefox` / `webkit`）とモバイル 3 種（`Mobile Chrome` / `Mobile Safari` / `Mobile Safari (Small screen)`）を定義します。
- 失敗時の調査用に `trace: 'on-first-retry'`、`screenshot: 'only-on-failure'`、`video: 'retain-on-failure'` を有効にしています。
- `baseURL`: E2E 専用の `http://localhost:4322/` に揃え、spec では `page.goto('/about')` のような相対パスを使います。

## fixture / route / POM

### `tests/e2e/fixtures/test.ts`

`@playwright/test` の `base` を拡張し、spec から以下を利用できるようにしています。

- `homePage` / `aboutPage` / `articlePage` / `tagPage` / `rssFeedPage` / `notFoundPage`: 対応するページオブジェクト
- `isDesktop`: viewport 幅（768px 以上）からデスクトッププロジェクトかどうかを判定する boolean。モバイルでヘッダーメニューを開くかどうかの分岐に使う

`isDesktop` が false（モバイル）のときは、ヘッダーのナビ/テーマトグルがハンバーガーメニュー内に隠れるため、`header.openMobileMenu()` でメニューを開いてから操作します。

### `tests/e2e/utils/routes.ts`

テストで使うルートを一箇所に集約します。URL 変更時の修正箇所を減らし、どのページをテストしているかを見通しやすくするためです。

```typescript
export const routes = {
  home: '/',
  about: '/about',
  sampleArticle: '/posts/audio-interface-under-the-desk',
  tagsBase: '/tags/',
  sampleArticleMarkdown: '/posts/audio-interface-under-the-desk.md',
  rss: '/rss.xml',
  notFound: '/this-route-does-not-exist',
} as const;

export const sampleArticleTitle = 'オーディオインターフェースを机の裏に設置した';
export const sampleTag = 'ガジェット';
export const sampleArticleDescription =
  'オーディオインターフェースを両面テープで机の下に設置するために、突っ張り棒を使って仮固定しました。';
```

`sampleTag` は `sampleArticle` が持つ代表タグで、タグページの `<h1>` と記事リンクの検証に使います。`tagsBase` と組み合わせて `/tags/{tag}` を組み立てます。

### `tests/e2e/utils/regex.ts`

`escapeRegExp` は、記事タイトルなどの動的な文字列を `RegExp` に埋め込む前にエスケープするためのヘルパーです。

`HOME_URL_REGEX` はホスト名に依存せずホーム URL (`/`) を判定するために使います。

## POM の方針

- POM は薄く保ちます。ロケーターと小さな操作だけを公開し、検証は spec 側に書きます。
- role、アクセシブル名、表示テキストなど、ユーザーに近いセマンティックロケーターを優先します。
- `data-testid` は最後の手段です。現時点ではアプリ側にテスト専用属性を追加しません。
- すべての `expect` に期待する状態・結果を具体的に表す日本語の custom message を付けます。通常は `expect(actual, message)`、`expect.poll` は options の `message` を使います。詳しくは Playwright 公式の [Custom expect message](https://playwright.dev/docs/test-assertions#custom-expect-message) を参照してください。

### コンポーネント (`tests/e2e/components/`)

- `header.ts`: `root`、`blogLink`、`aboutLink`、`themeToggle`、`hamburger`、`openMobileMenu()` を提供します。ヘッダーにはデスクトップ用とモバイル用のリンクが両方 DOM に存在するため、`blogLink` / `aboutLink` は `filter({ visible: true })` で「いま見えている」リンクを選択します（デスクトップは常時表示、モバイルはメニュー展開後に表示）。`openMobileMenu()` はハンバーガーボタン（`aria-label="メニューを開閉する"`）をクリックし、`aria-expanded="true"` になるまで待った後、Web Animations API でヘッダー配下の CSS animation / transition が完了するまで待ちます。fixed sleep は使わず、axe 検査やリンク操作がメニューの中間状態を扱わないようにします。
- `footer.ts`: `root`、`blogLink`、`aboutLink`、`rssLink` を提供します。
- `post-list.ts`: `<main>` 内の先頭の `<ul>` を記事一覧として扱います。Tailwind preflight により Chrome では `list` role が落ちるため、`getByRole('list')` は使いません。
- `post-metadata.ts`: `dot-separated` クラスのうち `<time>` を含む要素を記事メタデータとして扱います。
- `toc.ts`: `aria-label="目次"` の `<nav>` を TOC ルートとします。記事ページにはデスクトップ用（sticky サイドバー）とモバイル用（本文内インライン）の 2 つの TOC が DOM 上に存在し、ビューポート幅に応じて一方だけが可視になるため、`filter({ visible: true })` で表示中の方を選びます。`links` / `link(name)` / `currentLink` を提供します。

### ページオブジェクト (`tests/e2e/pages/`)

- `home-page.ts`: `goto()`、`header`、`footer`、`postList`
- `about-page.ts`: `goto()`、`header`、`footer`、`heading`
- `article-page.ts`: `goto(route, title)`、`header`、`footer`、`metadata`、`toc`、`heading`
- `tag-page.ts`: `goto(tag)`、`header`、`footer`、`postList`、`heading`（`<h1>{tag}のタグが付いた記事`）。`header` / `footer` / `postList` は他ページと同じ POM を再利用する
- `rss-feed-page.ts`: `goto()`、`response`、`content()`。RSS はブラウザ描画ではなく XML 応答のため `APIRequestContext` で取得し、`DOMParser` でパースする。`response` はステータス・ヘッダー検証用、`content()` はパース済みのチャネル/アイテムを返す
- `not-found-page.ts`: `goto()`（戻り値 `Response | null`）、`header`、`footer`、`heading`、`homeLink`

## spec の内容

### スモークテスト (`smoke.spec.ts`)

- ホーム: ページタイトルとサンプル記事リンクの表示を確認します。
- About: ページタイトルと `<h1>Daiki Sato</h1>` の表示を確認します。
- 記事: ページタイトルと記事見出しの表示を確認します。

### axe-core アクセシビリティ検査 (`accessibility.spec.ts`)

検査対象は以下の 3 ページです。

| 対象     | パス                                    |
| -------- | --------------------------------------- |
| ホーム   | `/`                                     |
| About    | `/about`                                |
| 代表記事 | `/posts/audio-interface-under-the-desk` |

デスクトップは `chromium`、モバイルは `Mobile Chrome` を対象に、それぞれ light / dark テーマを検査します。3 ページ × 2 project × 2 テーマ = 12 スキャンです。Firefox / WebKit / Mobile Safari / Mobile Safari (Small screen) は `test.skip` で明示的にスキップします。

各ページを 1 test とし、その中で `page.emulateMedia()` を light、dark の順に設定して、テーマごとにページを再読込します。`Mobile Chrome` ではページ読込後にモバイルメニューを開き、展開後のナビゲーションとテーマトグルも検査対象に含めます。

`AxeBuilder` には `tags`、`exclude`、無効化ルールを設定せず、best-practice を含む axe-core の既定ルールをすべて実行します。テスト（したがって CI）を失敗させるのは impact が `serious` または `critical` の違反だけです。`minor` / `moderate` は結果に記録しますが、テスト失敗にはしません。

各スキャンの完全な結果は `axe-results-light.json` / `axe-results-dark.json` として Playwright レポートに添付します。JSON には `violations`、`incomplete`、`passes`、`inapplicable` を含みます。一方、標準出力と GitHub Actions の annotation に出す失敗情報は、theme、rule ID、impact、target だけに絞ります。

axe-core による自動検査だけではアクセシビリティ適合を保証できません。キーボード操作、スクリーンリーダーでの読み上げ、認知的な分かりやすさ、および `incomplete` の項目は手動で確認する必要があります。

### ナビゲーションテスト (`navigation.spec.ts`)

デスクトップ・モバイル両方のプロジェクトで実行します。ヘッダーのナビゲーションはモバイルではハンバーガーメニュー内に隠れるため、`isDesktop` が false のときは `header.openMobileMenu()` でメニューを開いてからリンクをクリックします。

- ヘッダーの `Blog` / `About` リンクで正しいページへ遷移することを確認します。
- フッターの `Blog` / `About` リンクで正しいページへ遷移することを確認します。
- フッターでは `RSS feed` リンクが表示されることも確認します。
- モバイルメニューを開いた状態で画面幅を640px以上に広げると、メニューが閉じて本文をスクロールできることを確認します。
- モバイルメニューを開いている間はTab / Shift+Tabでハンバーガーボタンとメニュー内のリンク・ボタンの間を循環し、Escapeでメニューを閉じてハンバーガーボタンにフォーカスが戻ることを確認します。

### タグページテスト (`tag.spec.ts`)

タグページ（`/tags/[tag]`、静的生成）の基本表示を確認します。代表タグ（`ガジェット`）はサンプル記事を含む複数記事に付与されており、安定した検証対象として使います。

- 代表タグページにアクセスできること（URL が `/tags/` 配下、ページタイトルが `{tag} — Daiki Sato`）を確認します。
- 見出し `<h1>` に対象タグ名が含まれることを確認します。
- リスト内に対象タグを持つ記事（サンプル記事）のリンクが表示されることを確認します。
- リストのリンクから記事ページに遷移できることを確認します。

`toHaveURL` では URL がパーセントエンコードされるため、タグ名の文字列ではなく `` /tags/ `` パターンで URL を検証します。タグ名が含まれることは見出しとタイトルのアサーションで担保します。

### 404 ページテスト (`not-found.spec.ts`)

- 存在しない URL（`routes.notFound`）にアクセスしたとき、404 ステータスが返ることを確認する。
- ページタイトルと主要な見出し（`<h1>404: Page Not Found</h1>`）が期待どおりであることを確認する。
- 「ホームに戻る」リンクが表示され、クリックでホーム（`/`）に遷移することを確認する。デスクトップ・モバイル両方のプロジェクトで実行する。

### テーマ切り替えテスト (`theme.spec.ts`)

デスクトップ・モバイル両方のプロジェクトで実行します。テーマトグルはモバイルではハンバーガーメニュー内にあるため、`isDesktop` が false のときは各クリック前に `header.openMobileMenu()` でメニューを開きます（`page.reload()` でメニューは閉じるため、リロード後のクリックでも開き直します）。`page.emulateMedia({ colorScheme: 'light' })` でシステム配色を固定し、以下の順に確認します。

1. 初期状態では `localStorage.theme` がなく、`<html>` に `dark` / `light` クラスが付かない。
2. 1 回目のクリックで `dark` が適用される。
3. リロード後も `dark` が復元される。
4. 2 回目のクリックで `light` が適用される。
5. 3 回目のクリックでシステム設定に戻り、保存値が削除される。

### 記事本文のレスポンシブレイアウト (`article-layout.spec.ts`)

全 Playwright プロジェクトで実行し、ビューポートに応じて対象外の検証をスキップします。

- モバイルでは、コードブロックの有無が異なる2記事を対象に、本文が画面の左右16pxを除いた幅を使うことを確認します。
- モバイルでページ全体の横スクロールが発生しないことを確認します。
- デスクトップでは、本文とサイドバー目次の間に32pxのガターが維持されることを確認します。

### 目次 (TOC) (`toc.spec.ts`)

デスクトップ・モバイル両方のプロジェクトで実行します。見出しを持つ代表記事（サンプル記事、h2 x 2）を対象に、`src/scripts/toc.ts` によるクライアント側状態更新を含めて検証します。

- 記事ページで `aria-label="目次"` の `<nav>` が表示され、見出し数分のリンクが並ぶことを確認します。
- 初期状態（ページ先頭）では最初の見出しが `aria-current="location"` になることを確認します。
- TOC リンクをクリックすると URL ハッシュが更新され、対応見出しがビューポート内にスクロールされ、クリックしたリンクが `aria-current="location"` になることを確認します。
- ページ末尾へスクロールすると最後の見出しが current になることを確認します（`aria-current` がスクロール位置に追従する）。
- デスクトップ用（sticky サイドバー）とモバイル用（インライン）の 2 つの `<nav>` が DOM に存在し、ビューポート幅に応じて一方だけが可視になることを確認します。

### ビジュアルリグレッション (`visual.spec.ts`)

全 Playwright プロジェクトで実行します。フルページではなくロケーター単位でスクリーンショットを撮ることで、ベースラインを小さく保ち、無関係なコンテンツ変更の影響を減らします。

ベースラインはブラウザ・端末・OS ごとに必要です。CI（Linux）で生成・コミットする前提で、フォント描画差のあるローカル（macOS 等）では一致しないことがあります。

- 記事メタデータ: タグと日付の余白・レイアウト崩れを検出します。
- ヘッダー: ナビゲーションとテーマトグルの見た目を確認します。
- ホームの記事リスト項目: サンプル記事リンクの表示崩れを検出します。

全スクリーンショットで `animations: 'disabled'` を指定します。また、`tests/e2e/styles/screenshot.css` を `stylePath` で注入し、日本語フォントを `Noto Sans CJK JP` に固定します。

ローカルでビジュアルテストを実行する場合も `Noto Sans CJK JP` が必要です。Ubuntu / Debian では以下でインストールできます。

```sh
sudo apt-get install fonts-noto-cjk
```

### ページ全体のビジュアルリグレッション (`visual-pages.spec.ts`)

Markdown 処理系の移行などで「画面での表示が変わらない」ことを確認するため、サイトの全ページをフルページで撮影します。

- 対象: ホーム、About、Dreamhouse、全記事（`src/content/posts/*.md`、`template/` を除く）、全タグページ、404。記事とタグは `tests/e2e/utils/site-pages.ts` がソース（ファイル名と frontmatter の `tags`）から列挙します。列挙結果がビルド後の sitemap と一致することも検証するため、ページの追加漏れや列挙ロジックの誤りはテスト失敗になります。
- プロジェクト: `chromium`（ライト / ダーク）と `Mobile Chrome`（ライト）のみ。ダークは Shiki の `light-dark()` 配色や Callout のダーク用スタイルを確認するために撮影します。専用 config は 2 workers、retry なしで実行し、通常の `test:e2e` とは分離します。
- スナップショット名: ルート・プロジェクト・OS から決めます。例: `posts/nespresso-mold-light-chromium-linux.png`、`home-light-Mobile-Chrome-linux.png`。ベースラインが欠けていても通常実行では生成せず失敗させます。

決定性のための対策:

- **ビルド時ネットワークスタブ**: リンクカード（`src/lib/markdown/link-card.ts`）はビルド時に外部サイトの OGP・favicon・OG 画像を取得するため、ネットワーク状態や時刻で結果が変わります。`build:e2e` は `tests/e2e/support/network-stub.ts` をプリロードし、ビルド中の localhost 以外への HTTP(S) をすべてプロセス内のループバックのスタブサーバーへ転送します。差し替えるのは、undici の Dispatcher（どのバージョンの `undici` も読み込み時にパッチするため、`open-graph-scraper` のように独自 `Agent` を渡す場合も含む）、Node.js 組み込み `fetch`（グローバル Dispatcher）、`node:http` / `node:https`、`node:dns` の `lookup` です。スタブは URL から決まる og:title / og:description / og:image / favicon を持つ HTML と、URL のハッシュから色を決めた PNG を返し、HEAD には 200 を返します。og:image と favicon の URL には `*.e2e-stub.invalid` を使います。E2E ビルドではスタブ画像を `node_modules/.astro-e2e/link-card-images/` に保存し、通常のキャッシュとは分けます。ビルドプロセスの終了時に同ディレクトリからスタブ画像を削除します。置き換えたリクエストはビルドログに `[e2e-network-stub]` として出力されます。
- **ビルド時のタイムゾーン**: 記事の日付はビルド時に整形されるため、`TZ=UTC` に固定します。
- **ブラウザ側**: localhost 以外へのリクエストは `context.route()` で中断し、Service Worker も無効化します。テーマは `localStorage.theme` とシステム配色（`emulateMedia`）の両方で固定します。遅延読み込み画像を eager にして全画像のデコードと `document.fonts.ready` を待ち、読み込めない画像があれば失敗させます。`animations: 'disabled'` を指定します。
- **フォント**: `tests/e2e/styles/screenshot-pages.css` で本文を `Noto Sans CJK JP`、`code` / `pre` / `kbd` / `samp` を `Noto Sans Mono CJK JP` に固定します。等幅表示を保つことで、コードブロックの崩れも検出できます（どちらも `fonts-noto-cjk` に含まれます）。

ブラウザ時計は `2026-01-01T00:00:00Z`、locale は `ja-JP`、タイムゾーンは UTC に固定します。外部 iframe は余白を保ったまま非表示にします。記事一覧（ホームがアーカイブを兼ねる）、コードタイトル、Callout、リンクカードを含む全記事も対象です。外部サイトの内容そのものは合成カードで置き換えるため検証対象外です。

#### ベースラインの生成・更新

[Playwright 公式ガイド](https://playwright.dev/docs/test-snapshots) のとおり、生成と比較は同じ OS・ブラウザ・フォント環境で行います。CI の `visual` ジョブと同じ **`mcr.microsoft.com/playwright:v1.65.1-noble`（Linux amd64）** を使ってください。通常のホスト OS で更新しないでください。

```sh
docker run --rm --init --ipc=host --platform=linux/amd64 \
  -v "$PWD:/work" -v /work/node_modules -w /work \
  mcr.microsoft.com/playwright:v1.65.1-noble \
  sh -c 'npm install -g pnpm@12.16.1 && apt-get update && apt-get install -y fonts-noto-cjk && pnpm install --frozen-lockfile && pnpm run test:e2e:visual:update && pnpm run test:e2e:visual'
```

記事やタグを追加・変更したら、この手順で生成した `tests/e2e/specs/visual-pages.spec.ts-snapshots/` の PNG を目視確認してコミットします。削除したページの PNG は削除してください。失敗時は HTML report の expected / actual / diff を確認し、意図しない変化をベースライン更新で隠さないでください。CI は更新オプションなしで比較し、`visual-report` artifact にレポートと差分を保存します。

Playwright の更新時は lockfile のバージョンと CI・上記 Docker タグを揃え、同じ環境で全ベースラインを再生成してください。フォントやコンテナ OS の更新でも差分レビューが必要です。

### RSS フィードテスト (`rss.spec.ts`)

`/rss.xml` はブログ購読用の配信面。XML 応答を `APIRequestContext` で取得し、`DOMParser` でパースして検証する。`browserName !== 'chromium'` のプロジェクトを `test.skip` でスキップするため、`browserName === 'chromium'` となる `chromium` / `Mobile Chrome` の 2 プロジェクトで実行する。

検証内容:

- `/rss.xml` が 200 で応答し、`content-type` が XML 系（`application/xml` 等）であること。
- `<channel>` にサイト名（`config.siteName`）・説明・`<language>ja-jp</language>` が含まれること。
- 代表記事（`sampleArticleTitle`）のタイトルとリンクが `<item>` に含まれること。リンクはホスト・末尾スラッシュの差異に依存しないようパスで部分一致させる。
- RSS は公開記事のみを出力します。既存の standalone Markdown ページ（Dreamhouse）も従来どおり含みます。テンプレートはコレクション glob の対象外です。

### スナップショットの更新

コンポーネント単位のベースラインを更新する場合は以下を実行し、差分をコミットしてください。

```sh
pnpm run test:e2e:update
# 個別 spec のみ更新する場合
pnpm exec playwright test tests/e2e/specs/visual.spec.ts --update-snapshots
```

フルページ比較は既定の `playwright.config.ts` では除外しています。全ページを更新する場合は、上記「ベースラインの生成・更新」のコンテナ手順（`pnpm run test:e2e:visual:update`）を使ってください。

個別ページ・テーマ・プロジェクトだけ更新する場合も、CI と同じコンテナと専用 config を使います。例としてホームのライトテーマ（デスクトップ Chromium）の 1 枚だけを再生成する手順:

```sh
docker run --rm --init --ipc=host --platform=linux/amd64 \
  -v "$PWD:/work" -v /work/node_modules -w /work \
  mcr.microsoft.com/playwright:v1.65.1-noble \
  sh -c 'npm install -g pnpm@12.16.1 && apt-get update && apt-get install -y fonts-noto-cjk && pnpm install --frozen-lockfile && pnpm exec playwright test -c playwright.visual.config.ts --project=chromium --grep " ホーム（light）$" --update-snapshots=all'
```

`--project` と `--grep` で対象を絞り、`--update-snapshots=all` で一致したテストの画像だけを再生成します。検索文字列の先頭の空白と末尾の `$` は、「タグ スマートホーム」などの別テストを含めないために必要です。この例の出力先は `tests/e2e/specs/visual-pages.spec.ts-snapshots/home-light-chromium-linux.png` です。差分を目視確認し、意図した PNG だけをコミットしてください。

### raw Markdown エンドポイント (`raw-markdown.spec.ts`)

`/posts/[slug].md` の raw Markdown エンドポイントを `astro preview` 経由で検証します（実装: `src/pages/posts/[slug].md.ts`、仕様: `docs/raw-markdown-endpoints.md`）。Playwright の `request` fixture を使い、HTTP ステータス・`Content-Type`・本文を直接アサーションします。

- 代表記事の `.md` URL が `200` を返す
- `Content-Type` が `text/markdown` で始まる
  - `astro preview` は `text/markdown` のみを返すため、Playwright spec では media type だけを検証します。Worker による `charset=utf-8` の補完は `pnpm run test:worker` で厳密に検証します。
- frontmatter（`title` / `description`）と本文が含まれる
- Astro 表示用の `layout` frontmatter は除去されている（`^layout:` 行が存在しない）

通常記事 URL + `Accept: text/markdown` による content negotiation と、Cloudflare Workers Static Assets の応答に `charset=utf-8` を補う処理は `src/worker.ts` で実装しています。これらは `tests/worker/markdown-response.test.ts` で Worker の `fetch` 境界から検証し、直接の `.md` URLと content negotiation の両方が `Content-Type: text/markdown; charset=utf-8` を返すことを保証します。

ビルド済みアセットと実際の Wrangler 設定を使う検証は [Worker 統合テスト](./unit-testing.md#worker-統合テスト) を参照してください。

## GitHub Actions

In `.github/workflows/ci.yml`, `e2e-shard` runs one matrix job per Playwright project. Checkout and pnpm setup are shared with other jobs through YAML anchors.

1. Use the same digest-pinned `mcr.microsoft.com/playwright:v1.65.1-noble` container as `visual`, with `--ipc=host`. The image includes Chromium, Firefox, WebKit and their system dependencies; its version must match the locked `@playwright/test` version. [Playwright's CI guide](https://playwright.dev/docs/ci) documents container jobs and advises against caching browser binaries.
2. Install `fonts-noto-cjk` with `apt-get` without `sudo` inside the container.
3. Run `pnpm exec playwright test --project="$PROJECT" --reporter=github,list,blob`. The GitHub reporter produces failure annotations, and blob reports are retained for 1 day. Test results are retained for 7 days.
4. The separate `e2e` job merges the blob reports into an HTML report, publishes the Cloudflare preview, and uploads the HTML report as an artifact retained for 7 days. It still runs on the host runner, not in the browser container.

Report and test-result uploads use `if: ${{ !cancelled() }}` so that failed tests remain inspectable.

### ビルドの使い回しとキャッシュ

- `Build` ジョブの `dist/` は `dist` artifact として `Worker integration tests` に渡し、同じビルドを再実行しません。
- E2E シャードとフルページ VRT は、従来どおり各ジョブで Playwright の `webServer` がビルドします。E2E 用ビルドを別ジョブで 1 回にまとめると、シャードがそのジョブを待つぶん全体の所要時間が延びるためです。
- pnpm ストアのキャッシュは全ジョブで復元しますが、保存（`save-cache`）は main への push 時の `Build` ジョブだけが行います。
- `concurrency` は、PR の実行では ref 単位のグループで新しい push が古い実行をキャンセルします。main への push の実行はコミット（`github.sha`）ごとに別グループになるため、実行中・待機中のどちらもキャンセルされません。

## レポートを URL で閲覧する (Cloudflare Workers プレビュー)

artifact をダウンロードして開く代わりに、CI の実行結果からリンクをクリックするだけで HTML レポートを閲覧できるようにしています。レポートは本番ブログとは別の Cloudflare Worker（静的アセット配信）にアップロードします。

Cloudflare は新規プロジェクトに Pages ではなく Workers (Static Assets) を推奨しているため、本番ブログ (`wrangler.toml`) と同じく Workers を使います。

### 仕組み

- 配信専用の設定 `wrangler.report.toml`（`name = "blog-e2e-report"`、`[assets] directory = "./playwright-report"`）を用意しています。本番トラフィックには載せないため `main` やルートは設定せず、`workers_dev = false` / `preview_urls = true` でプレビュー URL のみ有効にしています。
- `e2e` ジョブの「Publish Playwright report to Cloudflare Worker preview」ステップで、`wrangler versions upload --config wrangler.report.toml --preview-alias <alias>` を実行します。`deploy` ではなく `versions upload` を使うため本番デプロイは発生せず、バージョンごとのプレビュー URL が払い出されます。
- `--preview-alias` で読みやすい固定 URL を付けます。エイリアスは PR では `pr-<番号>`、push ではブランチ名を DNS ラベル用に整形（小文字・英数字とハイフン・先頭は英字・47 文字以内）した値です。同じ PR への再 push では同じエイリアスを上書きするため、URL は常に最新のレポートを指します。
- レポート URL は `wrangler` の NDJSON 出力（`WRANGLER_OUTPUT_FILE_PATH` の `version-upload` エントリの `preview_alias_url` / `preview_url`）から取得し、ジョブの Summary に「レポートを開く」リンクとして出力します。
- このステップは best-effort です。レポート未生成・アップロード失敗・URL 取得失敗の各ケースでも `exit 0` し、artifact のフォールバックを案内します。フォーク PR ではシークレットが使えないためスキップします。

### 初回のみ必要な準備

1. **workers.dev サブドメインの登録**: プレビュー URL は `*.workers.dev` 上に作られるため、アカウントに workers.dev サブドメインが登録されている必要があります（Cloudflare ダッシュボードで一度だけ設定）。
2. **Worker のブートストラップ**: `wrangler versions upload` は既存の Worker に対してのみ動作します。新規 Worker は最初に一度だけ `deploy` で作成してください。

   ```sh
   # playwright-report/ が存在する状態で（なければ pnpm run test:e2e を先に実行）
   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
     pnpm exec wrangler deploy --config wrangler.report.toml
   ```

3. **GitHub Actions の認証情報の登録**: リポジトリに以下を設定します。
   - `CLOUDFLARE_API_TOKEN`: **Secret** に登録（`Workers Scripts:Edit` 権限をアカウント全体スコープで持つトークン。特定ワーカーに絞ると新規ワーカー `blog-e2e-report` を作成できないため注意）
   - `CLOUDFLARE_ACCOUNT_ID`: **Variable** に登録（認証情報ではなく識別子のため Secret 不要）

### 注意点

- プレビュー URL は公開され、認証はありません。失敗時のトレース・スクリーンショット・動画・DOM スナップショットなどがレポートに含まれるため、機微な情報がテスト対象に含まれないことを前提にしています。
- Workers Static Assets には 1 ファイル 25 MiB の上限があります。大きな動画やトレースでアップロードが失敗する場合は artifact から確認してください。

## 型チェック

`pnpm run lint` は `eslint && astro check && tsc --noEmit` を実行します。`astro check` は `.astro` ファイルと `src/` 配下を確認します。`tests/` 配下の TypeScript も型チェックできるように、`tsc --noEmit` を追加しています。

## gitignore

Playwright の生成物はコミットしません。

```gitignore
test-results/
playwright-report/
playwright/.cache/
blob-report/
```

なお、スモーク、ナビゲーション、タグ、テーマ、404、目次 (TOC)、ビジュアルリグレッション（コンポーネント単位）の各テストは、デスクトップ（Chromium / Firefox / WebKit）とモバイル（Mobile Chrome / Mobile Safari / Mobile Safari (Small screen)）の全 6 プロジェクトで実行します。axe-core アクセシビリティ検査と RSS フィードテストは `chromium` / `Mobile Chrome` の 2 プロジェクトで実行します。 ページ全体のビジュアルリグレッションは `chromium`（ライト / ダーク）と `Mobile Chrome`（ライト）で実行します。

## 下書きの回帰テスト

`drafts.spec.ts` は home・RSS・sitemap・下書き専用タグ・記事・raw Markdown の非公開を確認します。`E2E_DRAFT_FIXTURE=true` の E2E ビルドだけが `tests/e2e/fixtures/posts/` を collection loader に追加します。本番の `build` / `build:ci` は追加しません。フルページ VRT の列挙は公開ソースのみを使い、fixture のルートは sitemap にも現れません。

`build:e2e` は `--force` で Markdown をスタブ環境で再処理し、以前の実ネットワークのリンクカードを再利用しません。Astro の content-layer キャッシュは E2E が `node_modules/.astro-e2e`、本番が `node_modules/.astro` に分離されています。fixture の有効・無効で glob が変わっても、変更されていない記事のレンダリング結果は再利用されるため、分離しないと `build:e2e` の直後の `build:ci` にスタブのリンクカードが混入します。下書きの出力だけでなく、リンクカードの内容も本番キャッシュと分離する必要があります。
