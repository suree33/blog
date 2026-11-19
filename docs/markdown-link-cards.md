# Sätteri 用リンクカード

`src/lib/markdown/link-card.ts` は、Sätteri の mdast プラグイン `linkCard()` を提供します。
現在のサイトは引き続き unified と `remark-link-card-plus` を使用します。
このプラグインはテストからのみ実行し、`src/styles/link-card.css` も読み込みません。
レンダラーの切り替え、コードタイトル、Callout の移行は対象外です。

## 対象と HTML

ルート直下にある、子が 1 つだけの段落を対象にします。
裸の URL、山括弧の URL、表示文字列とリンク先が同じ URL のリンクをカードにします。
文中のリンク、リスト・引用内のリンク、表示文字列が異なるリンクは変換しません。
判定は `remark-link-card-plus@0.8.1` に合わせ、URL だけを強調した段落も対象です。

HTML の構造・属性は旧プラグインと同じで、クラスの接頭辞だけを
`remark-link-card-plus__` から `link-card__` に変更しています。
タイトル・説明・表示ホスト名は `sanitize-html` の既定設定で無害化し、属性値はエスケープします。
最初の OG 画像をサムネイルとして使い、画像がない場合はサムネイル要素を省略します。
favicon はページ内の指定を優先し、相対 URL はページの origin を基準に解決します。
指定がない場合は Google s2 の favicon URL を HEAD で確認します。

## 取得とキャッシュ

メタデータは旧プラグインと同じ `open-graph-scraper@6.13.0` で取得します。
既定のタイムアウトは 10 秒です。同じ URL の処理中の Promise と結果を
プラグインインスタンス内で共有し、メタデータと画像の重複取得を避けます。
メタデータのディスクキャッシュはありません。

favicon と OG 画像は `public/link-card-images/` に保存し、
`/link-card-images/` から参照します。このディレクトリは gitignore 済みです。
名前は `decodeURI` した画像 URL の SHA-256 と画像形式の拡張子です。
既存ファイルがあればダウンロードを省略します。
SVG は Content-Type、それ以外は `file-type` で形式を判定します。
画像の Content-Type だが形式を判定できない場合は、旧プラグイン同様 `.png` にします。

- メタデータ取得失敗: ホスト名をタイトルにし、説明は空、サムネイルなしのカードを生成します。
- Google HEAD が非 OK または例外: favicon を省略します。例外時に通常リンクへ戻る旧実装とは意図的に異なります。
- 画像の HTTP エラー・非画像・保存失敗: 警告を出して元のリモート URL を参照します。
  旧実装と異なり、HTTP エラーや非画像をキャッシュファイルとして保存しません。

## テスト用オプション

`linkCard({ fetch, cacheDirectory, timeout })` で通信・保存先・タイムアウト（ミリ秒）を差し替えられます。
`fetch` を指定した場合、メタデータもその関数で取得し、HTTP の charset でデコードした HTML を
`open-graph-scraper` の HTML 入力に渡します。未指定時は同ライブラリ本来の URL 取得
（文字コード推定・公開 IP 検証を含む）を使用します。
テスト用の fetch は信頼できる入力だけに使い、本番で公開 IP 検証を迂回する用途には使いません。

`src/lib/markdown/link-card.test.ts` はループバック HTTP サーバーと注入した fetch、
一時ディレクトリを使用し、外部サイトにはアクセスしません。
旧プラグインも同じ HTML を解析するよう OGS の URL 取得部分だけを差し替えます。
OGS は undici を直接使い、公開 IP 検証でループバックを拒否するためです。
Vitest は旧プラグインを inline 化して、その依存先にも同じモックを適用します。
HTML のメタデータ解析自体は両実装とも実際の OGS を通します。
Google HEAD の例外は旧実装と意図的に異なるため、新実装の期待値を直接検証します。
CSS は接頭辞の置換後にファイル全体が一致することを検証します。

```sh
pnpm run test:unit -- src/lib/markdown/link-card.test.ts
```

HTML 構造の比較であり、ブラウザ上の見た目は検証しません。
将来の組み込み時には `astro.config.mjs` の processor と CSS の読み込みを別途変更し、
既存記事とブラウザ上の表示を確認してください。
