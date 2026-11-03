# E2E テスト (Playwright)

このドキュメントでは、Playwright を使った E2E テストの構成、実行コマンド、CI での動かし方をまとめます。

## 概要

Astro のビルド結果を `astro preview` で起動し、スモークテスト、axe-core アクセシビリティ検査、ナビゲーション、タグページ、テーマ切り替え、404 ページ、全記事の巡回、Markdown 拡張の表示、ビジュアルリグレッションを検証します。主なブラウザ UI spec はデスクトップ（Chromium / Firefox / WebKit）とモバイル（Mobile Chrome / Mobile Safari / Mobile Safari (Small screen)）の 6 プロジェクトで実行し、axe-core アクセシビリティ検査と RSS フィードテストは `chromium` / `Mobile Chrome` の 2 プロジェクトで実行します。ページ全体のビジュアルリグレッションは `chromium`（ライト / ダーク）と `Mobile Chrome`（ライト）で、全記事の巡回は `chromium` / `Mobile Chrome` の 2 プロジェクトで実行します。

テストコードは Playwright の fixture とページオブジェクトモデル (POM) で構成しています。アサーションは spec に置き、POM はページ遷移や安定したロケーターの提供に限定します。

## コマンド

- `pnpm run test:e2e`: ヘッドレスで全 E2E テストを実行
- `pnpm run test:worker`: Worker の公開 HTTP レスポンス境界を Node.js Test Runner で検証
- `pnpm run test:unit`: ユニットテスト（Vitest）。詳細は `docs/unit-testing.md` を参照
- `pnpm run test:e2e:headed`: ブラウザを表示して実行
- `pnpm run test:e2e:ui`: Playwright UI モードで実行
- `pnpm run test:e2e:update`: ビジュアルスナップショットを更新

初回実行前にブラウザが必要です。未インストールの場合は以下を実行してください（config が Chromium / Firefox / WebKit を使うため 3 種すべて）。

```sh
pnpm exec playwright install chromium firefox webkit
```

Linux 環境でブラウザのシステム依存パッケージも入れる場合は、次のコマンドを使います。

```sh
pnpm exec playwright install --with-deps chromium firefox webkit
```

## ディレクトリ構成

```
playwright.config.ts          # Playwright 設定
tests/e2e/
├── components/               # UI 部品単位のロケーター
│   ├── header.ts             # <header> (banner)
│   ├── footer.ts             # <footer> (contentinfo)
│   ├── post-list.ts          # ホームの記事一覧
│   ├── post-metadata.ts      # 記事メタデータ
│   ├── markdown-content.ts   # 記事本文（Callout / コードブロック / リンクなど）
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
│   ├── site-pages.ts         # ページ全体 VRT の撮影対象と全記事の一覧（ソースから列挙）
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
    ├── navigation.spec.ts    # ヘッダー/フッターの遷移確認
    ├── tag.spec.ts           # タグページ (/tags/[tag]) の確認
    ├── theme.spec.ts         # テーマ切り替えの確認
    ├── toc.spec.ts           # 目次 (TOC) の表示・追従
    ├── posts.spec.ts         # 全記事の巡回（HTTP 200・記事レイアウト・h1）
    ├── markdown-features.spec.ts # Markdown 拡張（Callout / コードタイトル / リンクカード / 目次 / ハイライト）
    ├── not-found.spec.ts     # 404 ページの確認
    ├── visual.spec.ts        # ビジュアルリグレッション（コンポーネント単位）
    ├── visual-pages.spec.ts  # ビジュアルリグレッション（全ページ・フルページ）
    ├── rss.spec.ts           # RSS フィードの確認
    └── raw-markdown.spec.ts  # raw Markdown エンドポイント
```

ビジュアルスナップショットは `tests/e2e/specs/<spec ファイル名>-snapshots/` に保存します。`snapshotPathTemplate` で OS サフィックスを外し、プロジェクト名だけを付けます。例: `article-metadata-chromium.png`

## `playwright.config.ts` の要点

- `testDir`: `./tests/e2e/specs` を指定し、spec ファイルだけをテスト対象にします。
- `webServer`: `pnpm run build:e2e && pnpm run preview --port 4322` でプレビューサーバーを起動し、E2E 専用の `http://localhost:4322/` の応答を待ってからテストを開始します。通常の開発サーバーが使う `4321` とは競合しません。
- `build:e2e`: `prebuild`（`pnpm lint`）を経由しない `astro build` を、`TZ=UTC` と `NODE_OPTIONS=--import ./tests/e2e/support/network-stub.ts` 付きで実行します。ビルド時の外部 HTTP をスタブに置き換えるためです（後述の「ページ全体のビジュアルリグレッション」を参照）。本番用の `build` / `build:ci` は変更しません。
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
  // ...
  markdownFeaturesArticle: '/posts/resolve-sidekick-nvim-codex-search-error',
  calloutWarningArticle: '/posts/setup-obsidian-livesync',
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

`markdownFeaturesArticle` は Callout（Info / Note）、コードタイトル、リンクカード、目次、シンタックスハイライトをすべて含む記事で、`markdown-features.spec.ts` の代表記事です。`calloutWarningArticle` は Warning の Callout を含む記事です。

`sampleTag` は `sampleArticle` が持つ代表タグで、タグページの `<h1>` と記事リンクの検証に使います。`tagsBase` と組み合わせて `/tags/{tag}` を組み立てます。

### `tests/e2e/utils/site-pages.ts`

`posts` は `src/pages/posts/*.md`（`template/` と `_` 始まりを除く）から列挙した全記事（`slug` / `route` / frontmatter の `title`）です。`sitePages` はそれにホーム・About・Dreamhouse・全タグページ・404 を加えた、ページ全体 VRT の撮影対象です。`posts` は `posts.spec.ts` でも使います。

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
- `markdown-content.ts`: 記事本文（`<article>`）内の Markdown 由来の要素を特定します。Callout・コードタイトル・リンクカードは Markdown 処理系のプラグインが生成し、Sätteri への移行で HTML 構造やクラス名が変わりうるため、プラグイン固有のクラス名や data 属性は使いません。`callout(title, body)` はタイトルと完全一致するテキストと本文テキストの両方を含む最も内側の要素、`codeBlock(code)` はそのコードを含む `<pre>`、`linkTo(url)` はその URL への `<a href>`、`textExact(text)` は完全一致するテキスト、`tocHeadings` は本文の h2 / h3 です。
- `toc.ts`: `aria-label="目次"` の `<nav>` を TOC ルートとします。記事ページにはデスクトップ用（sticky サイドバー）とモバイル用（本文内インライン）の 2 つの TOC が DOM 上に存在し、ビューポート幅に応じて一方だけが可視になるため、`filter({ visible: true })` で表示中の方を選びます。`links` / `link(name)` / `currentLink` を提供します。

### ページオブジェクト (`tests/e2e/pages/`)

- `home-page.ts`: `goto()`、`header`、`footer`、`postList`
- `about-page.ts`: `goto()`、`header`、`footer`、`heading`
- `article-page.ts`: `goto(route, title)`、`header`、`footer`、`metadata`、`toc`、`content`（`MarkdownContent`）、`heading`
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

### 全記事の巡回 (`posts.spec.ts`)

Markdown 処理系の移行などで一部の記事だけが壊れることを検出するため、`utils/site-pages.ts` の `posts`（ソースから列挙した全記事）を 1 記事 1 テストで巡回します。

- HTTP 200 で返る。
- 記事レイアウト（`MarkdownPostLayout`）が適用されている: ページタイトルが `{title} — Daiki Sato`、ヘッダー（banner）とフッター（contentinfo）、`<article>` が 1 つ、記事メタデータの公開日（`<time>`）が表示される。
- `<article>` 内に frontmatter の `title` と完全一致する `<h1>` が 1 つだけ表示される。
- 本文に h2 / h3 がある記事では、表示中の目次に本文の h2 / h3 と同じ項目が同じ順で並ぶ。ない記事では目次（`<nav aria-label="目次">`）を出さない。

ブラウザ差の出にくい構造的な確認なので、`chromium` / `Mobile Chrome` の 2 プロジェクトで実行し、他は `test.skip` します（目次はデスクトップではサイドバー、モバイルでは本文内に表示されるため、両方の配置を確認できます）。列挙結果が sitemap と一致することは `visual-pages.spec.ts` が検証します。

### Markdown 拡張の表示 (`markdown-features.spec.ts`)

Callout、コードタイトル、リンクカード、目次、シンタックスハイライトが表示されることを、代表記事（`routes.markdownFeaturesArticle`、Warning の Callout は `routes.calloutWarningArticle`）で確認します。これらのプラグインは Sätteri への移行で置き換わる（remark-flexible-code-titles → Shiki transformer（置き換え済み、`docs/code-title.md`）、rehype-callouts / remark-link-card-plus → リポジトリ内の Sätteri 拡張など）ため、移行の前後で同じテストが通り続けるよう、プラグイン固有のクラス名・data 属性・DOM 構造には依存せず、利用者から見える振る舞いだけを確認します。見た目の細部は `visual-pages.spec.ts` が担当します。

- **Callout**（Info / Note / Warning）: タイトル（`Info` など）と本文が表示され、タイトルが本文より上にある。`[!NOTE]` などの記法がそのまま表示されていない。Callout が枠線または背景色で区別され、タイトルが本文と異なる文字色で強調される。
- **コードタイトル**: タイトル（例: `lua/sidekick/config.lua:106`）が表示され、`lua:...` の記法がそのまま表示されていない。タイトルがコードの 1 行目より上にあり、コードブロック（`<pre>`）に隙間なく付いていて（タイトルがブロックの内側に入る実装も許容）、左端が揃う。
- **リンクカード**: URL だけの段落が、その URL へのリンクとして表示され、リンク内にリンク先のタイトル（og:title）とホスト名が別の行に表示され、画像（OG 画像・favicon）がすべて読み込まれる。リンクの表示テキストが URL だけではない。E2E ビルドではネットワークスタブが og:title を `E2E スタブ: {ホスト名}{パス}` にするため、その接頭辞でタイトルを特定します。あわせて、文中の URL（Callout 内の autolink）はカードにならず、URL をテキストとする通常のリンクのままであることを確認します。
- **目次**: 目次に本文の h2 / h3 が順に並び、各リンクの `href` が見出しの `id` を指す。見出しの `id`（例: `#回避策workaround`）は外部から共有される URL の一部なので、生成規則が変わらないよう期待値を固定しています。
- **シンタックスハイライト**: システム配色をライト / ダークに切り替えて、コードのトークンが 3 色以上で色分けされること、ダークではライトと異なる配色・背景色になることを計算済みスタイルで確認します。

レイアウトや CSS（`light-dark()` など）のブラウザ差を検出するため、全 6 プロジェクトで実行します。

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

- 対象: ホーム、About、Dreamhouse、全記事（`src/pages/posts/*.md`、`template/` を除く）、全タグページ、404。記事とタグは `tests/e2e/utils/site-pages.ts` がソース（ファイル名と frontmatter の `tags`）から列挙します。列挙結果がビルド後の sitemap と一致することも検証するため、ページの追加漏れや列挙ロジックの誤りはテスト失敗になります。
- プロジェクト: `chromium`（ライト / ダーク）と `Mobile Chrome`（ライト）のみ。ダークは Shiki の `light-dark()` 配色や Callout のダーク用スタイルを確認するために撮影します。他のプロジェクトは `test.skip` します。
- スナップショット名: ルートから決めます。例: `posts/nespresso-mold-light-chromium.png`、`tags/ガジェット-dark-chromium.png`、`home-light-Mobile-Chrome.png`。

決定性のための対策:

- **ビルド時ネットワークスタブ**: リンクカード（`remark-link-card-plus`）はビルド時に外部サイトの OGP・favicon・OG 画像を取得するため、ネットワーク状態や時刻で結果が変わります。`build:e2e` は `tests/e2e/support/network-stub.ts` をプリロードし、ビルド中の localhost 以外への HTTP(S) をすべてプロセス内のループバックのスタブサーバーへ転送します。差し替えるのは、undici の Dispatcher（どのバージョンの `undici` も読み込み時にパッチするため、`open-graph-scraper` のように独自 `Agent` を渡す場合も含む）、Node.js 組み込み `fetch`（グローバル Dispatcher）、`node:http` / `node:https`、`node:dns` の `lookup` です。スタブは URL から決まる og:title / og:description / og:image / favicon を持つ HTML と、URL のハッシュから色を決めた PNG を返し、HEAD には 200 を返します。og:image と favicon の URL は `*.e2e-stub.invalid` にするため、`public/remark-link-card-plus/` に残った本物のキャッシュとは衝突しません。ビルドで書き出したスタブ画像は終了時に同ディレクトリ（と、置き換え予定のリンクカードプラグインの保存先 `public/link-card-images/`）から削除します。置き換えたリクエストはビルドログに `[e2e-network-stub]` として出力されます。
- **ビルド時のタイムゾーン**: 記事の日付はビルド時に整形されるため、`TZ=UTC` に固定します。
- **ブラウザ側**: localhost 以外へのリクエスト（Google Analytics / Partytown など）は `context.route()` で中断し、Service Worker も無効化します。テーマは `localStorage.theme` とシステム配色（`emulateMedia`）の両方で固定します。遅延読み込み画像を eager にして全画像のデコードと `document.fonts.ready` を待ち、読み込めない画像があれば失敗させます。`animations: 'disabled'` を指定します。
- **フォント**: `tests/e2e/styles/screenshot-pages.css` で本文を `Noto Sans CJK JP`、`code` / `pre` / `kbd` / `samp` を `Noto Sans Mono CJK JP` に固定します。等幅表示を保つことで、コードブロックの崩れも検出できます（どちらも `fonts-noto-cjk` に含まれます）。

記事やタグを追加・変更すると、そのページのベースラインが必要になります。`pnpm run test:e2e:update` でスナップショットを生成し、記事と一緒にコミットしてください。ベースラインは CI（GitHub Actions の ubuntu-latest）の描画が基準です。ローカル（コンテナや macOS）とはアンチエイリアスが異なるため、ローカルで生成したベースラインは CI で数百ピクセル程度ずれて失敗することがあります。

CI のベースラインへ差し替える手順:

1. ローカルで生成したベースラインをコミットして push し、CI の `e2e` ジョブを失敗させる。
2. 失敗した実行の `test-results` artifact をダウンロードする。失敗したテストごとに `*-actual.png`（CI での描画結果）が含まれる。
3. 各 `*-actual.png` を、対応するベースライン（`tests/e2e/specs/visual-pages.spec.ts-snapshots/` 配下の同じ名前のファイル）に上書きコピーしてコミットする。差分がなく成功したベースラインはそのままにする。

### RSS フィードテスト (`rss.spec.ts`)

`/rss.xml` はブログ購読用の配信面。XML 応答を `APIRequestContext` で取得し、`DOMParser` でパースして検証する。`browserName !== 'chromium'` のプロジェクトを `test.skip` でスキップするため、`browserName === 'chromium'` となる `chromium` / `Mobile Chrome` の 2 プロジェクトで実行する。

検証内容:

- `/rss.xml` が 200 で応答し、`content-type` が XML 系（`application/xml` 等）であること。
- `<channel>` にサイト名（`config.siteName`）・説明・`<language>ja-jp</language>` が含まれること。
- 代表記事（`sampleArticleTitle`）のタイトルとリンクが `<item>` に含まれること。リンクはホスト・末尾スラッシュの差異に依存しないようパスで部分一致させる。
- frontmatter 不足記事の扱い: `src/pages/rss.xml.ts` の `hasRequiredFrontmatter` により、`title` または `pubDate` frontmatter を持たない記事はフィードから除外される。本リポジトリに draft 扱いは存在せず、この frontmatter 条件のみで絞り込む。記事テンプレート (`src/pages/posts/template/_blog-post.md`) は `title` が未設定のため除外され、フィードに出現しないことを検証する（全 `<item>` が空でない `title`・`link` を持つこと、および `/template/` を含むリンクがないこと）。

### スナップショットの更新

意図した UI 変更でベースラインを更新する場合は以下を実行し、差分をコミットしてください。

```sh
pnpm run test:e2e:update
# 個別 spec のみ更新する場合
pnpm exec playwright test tests/e2e/specs/visual.spec.ts --update-snapshots
pnpm exec playwright test tests/e2e/specs/visual-pages.spec.ts --update-snapshots
```

### raw Markdown エンドポイント (`raw-markdown.spec.ts`)

`/posts/[slug].md` の raw Markdown エンドポイントを `astro preview` 経由で検証します（実装: `src/pages/posts/[slug].md.ts`、仕様: `docs/raw-markdown-endpoints.md`）。Playwright の `request` fixture を使い、HTTP ステータス・`Content-Type`・本文を直接アサーションします。

- 代表記事の `.md` URL が `200` を返す
- `Content-Type` が `text/markdown` で始まる
  - `astro preview` は `text/markdown` のみを返すため、Playwright spec では media type だけを検証します。Worker による `charset=utf-8` の補完は `pnpm run test:worker` で厳密に検証します。
- frontmatter（`title` / `description`）と本文が含まれる
- Astro 表示用の `layout` frontmatter は除去されている（`^layout:` 行が存在しない）

通常記事 URL + `Accept: text/markdown` による content negotiation と、Cloudflare Workers Static Assets の応答に `charset=utf-8` を補う処理は `src/worker.ts` で実装しています。これらは `tests/worker/markdown-response.test.ts` で Worker の `fetch` 境界から検証し、直接の `.md` URLと content negotiation の両方が `Content-Type: text/markdown; charset=utf-8` を返すことを保証します。

## GitHub Actions

`.github/workflows/ci.yml` に `e2e` ジョブを追加しています。`lint` / `build` と同じ checkout、pnpm、Node.js、依存関係インストールのステップを YAML anchor で再利用します。

`e2e` ジョブでは以下を実行します。

1. `fonts-noto-cjk` をインストールし、スクリーンショット用の日本語フォントを固定する。
2. `pnpm exec playwright install --with-deps chromium firefox webkit` で全ブラウザと必要なシステム依存パッケージをインストールする（config が 6 プロジェクトを定義するため、Firefox / WebKit も必要）。
3. `pnpm run test:e2e` を実行する。`playwright.config.ts` では `fullyParallel: true` と `workers: undefined` を組み合わせ、Playwright のデフォルト worker 数で spec 内テストを並列実行する。GitHub Actions 上では `github` reporter を `list` / `html` に追加し、失敗時の annotation を有効化する。
4. `playwright-report/` と `test-results/` を artifact としてアップロードする。

artifact の保持期間は 7 日です。テストが失敗した場合も調査できるよう、アップロードステップには `if: ${{ !cancelled() }}` を付けています。

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

なお、スモーク、ナビゲーション、タグ、テーマ、404、目次 (TOC)、ビジュアルリグレッション（コンポーネント単位）の各テストは、デスクトップ（Chromium / Firefox / WebKit）とモバイル（Mobile Chrome / Mobile Safari / Mobile Safari (Small screen)）の全 6 プロジェクトで実行します。Markdown 拡張の表示テストも全 6 プロジェクトで実行します。axe-core アクセシビリティ検査、RSS フィードテスト、全記事の巡回は `chromium` / `Mobile Chrome` の 2 プロジェクトで実行します。ページ全体のビジュアルリグレッションは `chromium`（ライト / ダーク）と `Mobile Chrome`（ライト）で実行します。
