---
title: .zshrc の起動が遅い原因を Codex に調査させたら、10倍速くなった
pubDate: 2026-02-27
tags:
  - Zsh
  - 最適化
  - AI
---
最近 `.zshrc` の起動が体感で遅くなっていたので、原因調査から修正まで Codex に丸投げしてみた。

作業後、この記事もCodexに下書きしてもらった。ほぼ全部手直ししたけど。

## 症状

まず Codex に現状の計測から始めてもらった。

> .zshrc で時間がかかっています。何が原因か調べたい。どうしたらいい？

```bash
for i in {1..5}; do /usr/bin/time zsh -i -c exit >/dev/null; done
```

実行結果（実測）:

```plaintext
1.33 real
1.17 real
1.01 real
1.04 real
1.18 real
```

平均して 1 秒台前半かかっていたっぽい。実際 `time zsh -i -c exit` を手動で何度か実行してみたら、2秒を超える時もあった。遅すぎ。

## 改善策を練る

CodexのPlanモードで、具体的な改善策を練ってもらった。

> 具体的にどうすべきか、詳細をまずは検討してください

### 1. zprof で内訳を見る

Codex が `zprof` を使って処理時間の内訳を可視化してくれた。

```bash
tmp=$(mktemp -d)
cat > "$tmp/.zshrc" <<'ZPROF_EOF'
zmodload zsh/zprof
source ~/.zshrc
zprof
ZPROF_EOF
ZDOTDIR="$tmp" zsh -i -c exit
```

実際の `zprof` 出力（抜粋）:

```plaintext
num  calls                time                       self            name
-----------------------------------------------------------------------------------
 1)    2         470.73   235.36   47.02%    470.73   235.36   47.02%  compdump
 2)    2         968.56   484.28   96.74%    354.90   177.45   35.45%  compinit
 3) 1963         124.10     0.06   12.40%    124.10     0.06   12.40%  compdef
```

Codex によると `compinit` / `compdump` が時間の大半を占めており、しかも `calls=2` と 2 回呼ばれていることが問題らしい。

### 2. compinit の呼び出し元を特定

Codex が `compdump` をラップして呼び出し元をトレースし、`~/.bun/_bun` 内で `compinit` が呼ばれていることを突き止めてくれた。

呼び出し元トレースの実際の出力:

```plaintext
COMPDUMP caller=/usr/share/zsh/5.9/functions/compinit:549 | /Users/sur33/.bun/_bun:964 | /Users/sur33/.zshrc:66 | ...
```

該当箇所（`~/.bun/_bun`）:

```zsh
if ! command -v compinit >/dev/null; then
  autoload -U compinit && compinit
fi
```

`.zshrc` 側でも後段で `compinit` を呼んでいたため、二重実行に近い構成になっていたみたい。

## 修正

Codex が提案してきた計画は概ねこれだけ:

1. `source ~/.bun/_bun` を `compinit` の後ろに移動する

とにかく「`compinit` を先に 1 回実行して、`_bun` 側での `compinit` 発火条件を満たさないようにする」ことが重要らしい。

## 結果

修正後の計測:

- 起動時間: `0.17s〜0.6s`
- `zprof` 上の `compinit` 呼び出し回数: `1`
- `~/.zcompdump` の mtime: 連続起動で変化なし（毎回再生成しない）
- `bun` 補完: `_comps[bun]=_bun` で有効を確認

大体0.1〜0.2秒で、たまに0.6秒くらいかかる感じ。特に手戻りなく**一発で10倍速くなって神**。

## `compinit -C` について

`compinit -C` するとキャッシュを利用してくれるけど、これだけだとキャッシュを生成してくれないので、結局たまにキャッシュを再生成しないといけなくなるっぽい。

`compinit` はデフォルトでキャッシュを使うかどうかも判断してくれるので、それがベストプラクティスなんだって。とはいえ参考にした記事も一つ目はAI臭い感じの文章だったので、どれくらい正しいかは不明。

## 参考

https://zenn.dev/i9wa4/articles/2026-01-01-zsh-startup-optimization-compinit

https://qiita.com/vintersnow/items/c29086790222608b28cf