# Sätteri 用リンクカード

`src/lib/markdown/link-card.ts` は、Sätteri の mdast プラグイン `linkCard()` を提供します。
現在のサイトは引き続き unified と `remark-link-card-plus` を使用します。
このプラグインはテストからのみ実行し、`src/styles/link-card.css` も読み込みません。
レンダラーの切り替え、コードタイトル、Callout の移行は対象外です。

## 対象と HTML

ルート直下にある、子が 1 つだけの段落を対象にします。
裸の URL、山括弧の URL、表示文字列とリンク先が同じ URL のリンクをカードにします。
文中のリンク、リスト・引用内のリンク、表示文字列が異なるリンクは変換しません。
判定は `remark-link-card-plus@0.8.2` に合わせ、URL だけを強調した段落も対象です。

HTML の構造・属性は旧プラグインと同じで、クラスの接頭辞だけを
`remark-link-card-plus__` から `link-card__` に変更しています。
タイトル・説明・表示ホスト名は `sanitize-html` の既定設定で無害化し、属性値はエスケープします。
最初の OG 画像をサムネイルとして使い、画像がない場合はサムネイル要素を省略します。
favicon はページ内の指定を優先し、相対 URL はページの origin を基準に解決します。
指定がない場合は Google s2 の favicon URL を HEAD で確認します。

## 取得とキャッシュ

メタデータは旧プラグインと同じ `open-graph-scraper@6.13.0` で取得します。
現在の main の `remark-link-card-plus@0.8.2` は OGS に `{ url, timeout: 10 }` を渡します。
OGS の単位は秒なので、メタデータ取得の既定値も同じ **10 秒**にしています。
Google favicon の HEAD と画像 GET は、旧実装と同じ `AbortSignal.timeout(10000)`（10 秒）です。
同じ URL の処理中の Promise と結果を
プラグインインスタンス内で共有し、メタデータと画像の重複取得を避けます。
メタデータのディスクキャッシュはありません。

favicon と OG 画像は `public/link-card-images/` に保存し、
`/link-card-images/` から参照します。このディレクトリは gitignore 済みです。
名前は `decodeURI` した画像 URL の SHA-256 と画像形式の拡張子です。
既存ファイルがあればダウンロードを省略します。
SVG は Content-Type、それ以外は `file-type` で形式を判定します。
画像の Content-Type だが形式を判定できない場合は、旧プラグイン同様 `.png` にします。

- メタデータ取得失敗: ホスト名をタイトルにし、説明は空、サムネイルなしのカードを生成します。
- Google HEAD が非 OK: 旧実装と同じく favicon を省略します。
- Google HEAD が例外（タイムアウトを含む）: 旧実装と同じく段落を変換せず、通常のリンクを残します。
- 画像の GET・読み取り・保存が例外: 旧実装もダウンロード結果を未定義にして元 URL を使うため、同じリモート参照に戻します。
- HTTP エラーでも有効な画像本文: 旧実装は `response.ok` を見ずに保存し、ローカルの正常な画像として表示します。
  新実装も画像本文を保存します。ステータスだけで拒否すると、旧実装で表示できた画像が表示できなくなるためです。
- PDF など `file-type` が非画像 MIME と判定した本文、画像として判定できず画像 Content-Type もない本文:
  保存せずリモート URL を参照します。旧実装は PDF や HTML もファイルに保存しますが、
  `<img>` では表示できない本文なので、旧実装の正常な画像を失う変更ではありません。
  不明な形式でも画像 Content-Type なら、旧実装同様に `.png` として保存します。

## テスト用オプション

`linkCard({ fetch, cacheDirectory, timeout })` で通信・保存先・タイムアウト（ミリ秒）を差し替えられます。
`timeout` を明示するとメタデータ・HEAD・画像すべてにその値を使い、OGS に渡す場合だけ秒へ変換します。
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
Google HEAD の例外、画像 GET の例外、有効な画像を返す 404 応答も旧実装と比較します。
CSS は接頭辞の置換後にファイル全体が一致することを検証します。

```sh
pnpm run test:unit -- src/lib/markdown/link-card.test.ts
```

HTML 構造の比較であり、ブラウザ上の見た目は検証しません。
将来の組み込み時には `astro.config.mjs` の processor と CSS の読み込みを別途変更し、
既存記事とブラウザ上の表示を確認してください。
