---
title: sidekick.nvimでCodexを使うと表示される [features].web_search_request is deprecated を解消する
pubDate: 2026-02-16
updatedDate: 2026-03-17
tags:
  - AI
  - Neovim
  - Codex
description: sidekick.nvimでCodexを使うと毎回エラーが表示されてしまうので、PRを作成しつつ、一時的な回避策を講じることにしました。
---

> [!INFO]
> sidekick.nvim 側で修正されたため、現在はこの問題は解消しています。
> <https://github.com/folke/sidekick.nvim/pull/257>

NeovimでClaude CodeやCodexなどを使うために [sidekick.nvim](https://github.com/folke/sidekick.nvim/) を使っているのですが、Codexを使った際に

```plaintext
[features].web_search_request` is deprecated. Use `web_search` instead
```

というエラーが表示されます。

![実際のエラーメッセージのスクリーンショット](images/resolve-sidekick-nvim-codex-search-error-error.png)

このエラーは sidekick.nvim の `lua/sidekick/config.lua` で `--enable web_search_request` が付加されていることによって起こっています。

```lua title="lua/sidekick/config.lua:106"
codex = { cmd = { "codex", "--enable", "web_search_request" } },
```

<https://github.com/folke/sidekick.nvim/blob/c2bdf8cfcd87a6be5f8b84322c1b5052e78e302e/lua/sidekick/config.lua#L106>

> [!NOTE]
> `--enable web_search_request` はCodexがウェブ検索できるようにするためのオプションです。ただ、[現在のCodexはウェブ検索がデフォルトで有効化されている](https://developers.openai.com/codex/changelog/#codex-2026-01-28-mdx)ため、このオプションは不要になりました。

<https://developers.openai.com/codex/changelog/#codex-2026-01-28-mdx>

## 回避策（workaround）

sidekick.nvim の設定で `cli.tools.codex.cmd` を上書きし、シンプルに `codex` のみにします。

```lua title="lua/plugins/sidekick.lua"
return {
  {
    "folke/sidekick.nvim",
    config = function()
      require("sidekick").setup({
        cli = {
          tools = {
            codex = {
              cmd = { "codex" },
            },
          },
        },
      })
    end,
  },
}
```

## 根本的な修正

[folke/sidekick.nvim](https://github.com/folke/sidekick.nvim/) に向けてこの問題を解消するためのPRを作成しましたが、 folke/sidekick は最近あまり更新されていないようで、いつマージされるか不明です。そのため、この記事を作成しました。

> [!NOTE]
> 2026年3月16日にマージ済

<https://github.com/folke/sidekick.nvim/pull/257>

## 参考

<https://github.com/folke/sidekick.nvim/>

<https://github.com/folke/sidekick.nvim/pull/257>

<https://developers.openai.com/codex/cli/features/#web-search>
