# Sätteri 用リンクカード

`src/lib/markdown/link-card.ts` は、Sätteri の mdast プラグイン `linkCard()` を提供します。
`src/lib/markdown/link-card-assets.ts` の `createLinkCards()` は、Markdown プラグインと Astro integration を返します。
`astro.config.mjs` で、それぞれを Sätteri の `mdastPlugins` と Astro の `integrations` に登録しています。
`src/styles/global.css` は `src/styles/link-card.css` を読み込みます。
コードタイトルは Shiki transformer、Callout は別の HAST プラグインで処理します。

## 対象と HTML

ルート直下にある、子が 1 つだけの段落を対象にします。
裸の URL、山括弧の URL、表示文字列とリンク先が同じ URL のリンクをカードにします。
文中のリンク、リスト・引用内のリンク、表示文字列が異なるリンクは変換しません。
判定は `remark-link-card-plus@0.8.2` に合わせ、URL だけを強調した段落も対象です。

HTML の構造・属性は旧プラグインと同じで、クラスの接頭辞だけを
`remark-link-card-plus__` から `link-card__` に変更しています。
タイトル・説明・表示ホスト名は `sanitize-html` の既定設定で無害化し、属性値はエスケープします。
最初の OG 画像をサムネイルとして使います。画像がない場合や取得に失敗した場合は、サムネイル要素を省略します。
favicon はページ内の指定を優先し、相対 URL はページの origin を基準に解決します。
指定がない場合は Google s2 の favicon URL を HEAD で確認します。

## 取得とキャッシュ

メタデータは旧プラグインと同じ `open-graph-scraper@6.13.0` で取得します。
以前使用していた `remark-link-card-plus@0.8.2` は OGS に `{ url, timeout: 10 }` を渡していました。
OGS の単位は秒なので、メタデータ取得の既定値も同じ **10 秒**にしています。
Google favicon の HEAD と画像 GET は、旧実装と同じ `AbortSignal.timeout(10000)`（10 秒）です。
同じ URL の処理中の Promise と結果を
プラグインインスタンス内で共有し、メタデータと画像の重複取得を避けます。
メタデータのディスクキャッシュはありません。

favicon と OG 画像は Astro の `config.cacheDir` 配下の `link-card-images/` に保存し、
公開 URL は従来どおり `/link-card-images/` を使います。
通常の保存先は `node_modules/.astro/link-card-images/`、E2E 用は `node_modules/.astro-e2e/link-card-images/` です。
パスは `astro:config:done` で受け取る設定から解決し、作業ディレクトリには依存しません。
名前は `decodeURI` した画像 URL の SHA-256 と画像形式の拡張子です。
既存ファイルがあればダウンロードを省略します。
SVG は Content-Type、それ以外は `file-type` で形式を判定します。
画像の Content-Type だが形式を判定できない場合は、旧プラグイン同様 `.png` にします。

### Astro のビルドキャッシュと開発サーバー

Astro は内容が変わらない記事の描画済み HTML をデータストアから再利用します。
このとき Markdown プラグインは実行されません。
Cloudflare Workers Builds は `node_modules/.astro` をキャッシュしますが、生成された `public/` の画像は保存しません。
画像も `config.cacheDir` に保存することで、HTML と画像を一緒にキャッシュします。

integration は毎回の `astro:build:done` で、画像をフックの `dir` が指すクライアント出力先へコピーします。
記事の再描画がないビルドでも画像を出力します。
`astro:server:setup` では Vite middleware を登録し、開発時も同じ公開 URL でキャッシュ画像を配信します。

`src/content.config.ts` は `glob()` を `withLinkCardImages()` で包みます。
この loader は、データストア内の描画済み HTML が参照する画像を読み込み前に確認します。
1 つでも画像がなければ、公開 API の `store.clear()` でコレクションを消してから `glob()` を実行し、記事を再描画します。
旧 `public/link-card-images/` 方式からの移行時や画像キャッシュだけが失われた場合も、自動で画像を再取得します。
取得失敗時のリモートサムネイル URL が古い HTML に残っている場合も、記事を再描画します。リモート favicon は対象外です。
integration の追加だけで Astro がデータストアを無効化するとは想定していません。

関連 API: [Astro integration hooks](https://docs.astro.build/en/reference/integrations-reference/)、
[Content Loader API](https://docs.astro.build/en/reference/content-loader-reference/)。

- メタデータ取得失敗: ホスト名をタイトルにし、説明は空、サムネイルなしのカードを生成します。
- Google HEAD が非 OK: 旧実装と同じく favicon を省略します。
- Google HEAD が例外（タイムアウトを含む）: 旧実装と同じく段落を変換せず、通常のリンクを残します。
- OG 画像の GET はリダイレクト後の応答が 2xx で、Content-Type が `image/` で始まるか、`file-type` が画像 MIME と判定した場合だけ保存します。
  HTTP エラー、通信・読み取り・保存の例外（タイムアウトを含む）、Content-Type と本文のどちらからも画像と判定できない応答、
  `file-type` が非画像 MIME と判定した本文では、画像がない場合と同じ HTML を生成します。
  再試行やブラウザ風ヘッダーによる再取得は行いません。
- favicon の取得失敗時は、従来どおりリモート URL を参照します。
- 不明な形式でも画像 Content-Type なら、従来どおり `.png` として保存します。

## テスト用オプション

`linkCard({ fetch, cacheDirectory, timeout })` で通信・保存先・タイムアウト（ミリ秒）を差し替えられます。
単独で使う場合は `cacheDirectory` の指定が必須です。
Astro からは `createLinkCards()` が解決した保存先を渡します。
`timeout` を明示するとメタデータ・HEAD・画像すべてにその値を使い、OGS に渡す場合だけ秒へ変換します。
`fetch` を指定した場合、メタデータもその関数で取得し、HTTP の charset でデコードした HTML を
`open-graph-scraper` の HTML 入力に渡します。未指定時は同ライブラリ本来の URL 取得
（文字コード推定・公開 IP 検証を含む）を使用します。
テスト用の fetch は信頼できる入力だけに使い、本番で公開 IP 検証を迂回する用途には使いません。

`src/lib/markdown/link-card.test.ts` はループバック HTTP サーバーと注入した fetch、
一時ディレクトリを使用し、外部サイトにはアクセスしません。
OGS の URL 取得だけをモックし、HTML のメタデータ解析は実際の OGS を通します。
旧プラグインの出力は削除前にスナップショットとして保存しました。
Google HEAD の例外、画像 GET の例外、有効な画像を返す 404 応答も固定 HTML と比較します。
OG 画像のリダイレクト後の 403、タイムアウト、Content-Type の欠落・非画像応答は fetch をモックして検証します。
CSS は接頭辞を置換した旧 CSS の fixture とファイル全体を比較します。

```sh
pnpm run test:unit -- src/lib/markdown/link-card.test.ts
pnpm exec vitest run --config vitest.integration.config.ts tests/integration/link-card-images.test.ts
```

`link-card-assets.test.ts` は loader の再描画判定と画像コピーの空・正常・エラーケースを検証します。
`tests/integration/link-card-images.test.ts` は外部通信をモックした Astro サイトをビルドし、
初回・キャッシュあり・画像キャッシュ欠落の各状態で HTML と画像を確認します。
同じサイトを開発サーバーでも起動し、画像の GET・HEAD と存在しない画像の 404 を確認します。

単体テストは HTML 構造を比較します。ブラウザ上の見た目は全ページのビジュアル回帰テストで検証します。
