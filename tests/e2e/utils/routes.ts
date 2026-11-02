/**
 * E2E スイート全体で使用するルートパスを集約したもの。
 *
 * ルートを一箇所にまとめることで、URL 変更への耐性を高め、
 * テスト行列でカバーしているページを明確にする。
 */
export const routes = {
  home: '/',
  about: '/about',
  sampleArticle: '/posts/audio-interface-under-the-desk',
  articleWithoutCodeBlock: '/posts/nespresso-mold',
  articleWithCodeBlock: '/posts/resolve-sidekick-nvim-codex-search-error',
  /**
   * Markdown 拡張の表示確認に使う代表記事。Callout（Info / Note）、コードタイトル、
   * リンクカード、目次、シンタックスハイライトをすべて含む。
   */
  markdownFeaturesArticle: '/posts/resolve-sidekick-nvim-codex-search-error',
  /** Warning の Callout を含む記事。 */
  calloutWarningArticle: '/posts/setup-obsidian-livesync',
  tagsBase: '/tags/',
  /** `routes.sampleArticle` の raw Markdown エンドポイント。 */
  sampleArticleMarkdown: '/posts/audio-interface-under-the-desk.md',
  rss: '/rss.xml',
  /**
   * 存在しないルート。404 ページの検証に使用する。
   *
   * 固定文字列にしておくことで、ルーティング変更時の影響を避け、
   * 「存在しない URL」という前提が常に成り立つようにする。
   */
  notFound: '/this-route-does-not-exist',
} as const;

/**
 * `routes.sampleArticle` が参照するサンプル記事のタイトル。
 *
 * セマンティックロケーター（`getByRole('link', { name: ... }`）や
 * タイトルアサーションに使用し、spec が DOM 構造に依存しないようにする。
 */
export const sampleArticleTitle =
  'オーディオインターフェースを机の裏に設置した';

/**
 * `routes.sampleArticle` が参照するサンプル記事の代表タグ。
 *
 * `routes.sampleArticle` がこのタグを持つため、サンプル記事リンクの表示確認に
 * 使える。タグページ spec はこのタグを代表ページとして検証する。
 */
export const sampleTag = 'ガジェット';

/**
 * `routes.sampleArticle` の frontmatter `description`。
 *
 * raw Markdown エンドポイントが frontmatter を含めて返すことを検証するために使用する。
 */
export const sampleArticleDescription =
  'オーディオインターフェースを両面テープで机の下に設置するために、突っ張り棒を使って仮固定しました。';
