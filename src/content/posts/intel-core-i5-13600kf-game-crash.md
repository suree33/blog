---
title: Intel Core i5-13600KFでゲームがクラッシュする問題
pubDate: 2024-07-31
updatedDate: 2024-08-02
tags:
  - ガジェット
  - PC
  - 不具合
description: Intel Core 第13/14世代プロセッサに関する不具合により、ゲームが頻繁にクラッシュする問題に関して、試したことやIntelのサポートとのやり取りをまとめました。
---

ゲームプレイ中にゲームが頻繁にクラッシュして落ちる症状に悩まされています。多分、もう1年以上。

最初は数十分に1度程度の頻度でしたが、最近はひどい時は数分に一度発生するようになり、実質プレイ不可能な状況です。ただ、全てのゲームでこれが起きるわけではなく、一部ゲームのみです。また、グラフィック設定を下げると頻度が下がる傾向にあります。

| ゲームタイトル        | 症状の発生有無 |
| --------------------- | -------------- |
| Forza Horizon 5       | **あり**       |
| Monster Hunter: World | **あり**       |
| Valorant              | なし           |
| Overwatch 2           | なし           |
| Apex Legends          | なし           |
| Civilization VI       | なし           |

## PCの構成

| パーツ       | 製品名                                   |
| ------------ | ---------------------------------------- |
| CPU          | Intel Core i5-13600KF                    |
| マザーボード | ASUS PRIME Z790-A WIFI-CSM               |
| メモリ       | Crucial 16GB DDR5-4800 (2枚)             |
| GPU          | GeForce RTX 4070Ti (Manli M-NRTX4070TIG) |
| CPUファン    | Noctua NH-U12S                           |
| ストレージ   | Crucial P5 Plus 2TB                      |
| 電源         | SilverStone SST-DA750-G                  |

## まず試したこと

- ゲームのインストールし直し
- PCの初期化（クリーンインストール）

もちろん、これでは解決しませんでした。

## Intel Core 第13/14世代プロセッサの不具合

ここで色々調べているうちに、Intel Core 第13/14世代プロセッサに関する不具合が報告されていることを知りました。

https://www.theverge.com/2024/7/22/24203959/intel-core-13th-14th-gen-cpu-crash-update-patch

この問題はCPUの電圧設定に関連しているようで、この問題に関してすでに問題が起こっている場合、CPUは物理的に故障しており、ソフトウェアのアップデートで修正できない可能性があるようです。絶望。

> the company confirmed a patch is coming in mid-August that should address the “root cause” of exposure to elevated voltage. But if your 13th or 14th Gen Intel Core processor is already crashing, that patch apparently won’t fix it.

https://www.theverge.com/2024/7/26/24206529/intel-13th-14th-gen-crashing-instability-cpu-voltage-q-a

8月にはIntelがこの問題に対するパッチをリリース予定ですが、このパッチを適用しても問題が解決しない可能性があるということになります。

https://pc.watch.impress.co.jp/docs/news/1610334.html

## Intelに問い合わせ

Intelはこの問題に関して不安定動作が起こっている場合、サポートに問い合わせるように呼び掛けています。

https://community.intel.com/t5/Processors/July-2024-Update-on-Instability-Reports-on-Intel-Core-13th-and/m-p/1617113#M74792

そこで、Intelのサポートに問い合わせてみました（2024/7/24）。

https://www.intel.co.jp/content/www/jp/ja/support/contact-us.html

### 返信1 （2024/7/25）

すると、以下の内容を求める回答がありました。

- 製品情報
  - CPUのATPO番号
  - CPUのFPO番号
- 私の情報
  - 名前
  - 住所
- パソコンの構成
  - マザーボード
  - メモリ
  - グラフィックボード
  - 電源ユニット
  - CPU冷却ユニット
  - その他増設機器など

また、これらに加え、マザーボードのBIOSのアップデートの提案がありました。

当時、BIOSのバージョンは1658でしたが、最新のバージョン1661がリリースされていました。このバージョンには、eTVBをIntelの設定に合わせて動作するようにするmicrocode 0x125の更新が含まれています。

https://www.asus.com/jp/motherboards-components/motherboards/prime/prime-z790-a-wifi/helpdesk_bios?model2Name=PRIME-Z790-A-WIFI

これは今回の問題の原因の一つとして考えられているもので、一時的な解決策のようです。結局、根本的な問題を解決するためには8月のパッチを待つ必要があるようですが、とりあえずサポートの指示通りにBIOSのアップデートを行いました。が、やはり問題は解決しませんでした。

上記の内容をIntelに返信しました。

### 返信2 （2024/7/30）

ここで、驚くべきことに、交換対応の提案がありました。[The Vergeによる問い合わせ結果](https://www.theverge.com/2024/7/26/24206529/intel-13th-14th-gen-crashing-instability-cpu-voltage-q-a)によるとリコールや保証の延長の予定は無いということだったので、交換もしてもらえないと思い込んでいたので、正直驚きました。

具体的な手順は、こちらからCPUを着払いで送り、IntelがCPUを検査した後に交換品（良品）を送ってくれるというものです。つまり、その間はPCが使えないということになります。辛い……。

とりあえず60日以内に済ませれば良いようです。交換品が届いてもまた壊れたら意味がないので、8月のパッチがリリースされるまで様子を見ることにしました。
