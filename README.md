# Topsters5

> **Work in Progress** — This is an unofficial development preview. No formal release has been made yet.
>
> **開発中** — 非公式のプレビュー版です。正式リリースはまだ行っていません。

A fork of [GiraffeKey's ChartYourMusic](https://github.com/GiraffeKey/chartyourmusic), with added mobile support and other improvements.

[GiraffeKeyさん の ChartYourMusic](https://github.com/GiraffeKey/chartyourmusic) をベースに、モバイル対応などの改善を加えたフォークです。

The development preview is available here / 開発中プレビューはこちら: <https://topsters5.vercel.app/>

---

## Contributing / コントリビュート

Contributions are welcome! If you find a bug or have an idea for a new feature, feel free to open an [Issue](https://github.com/insane-catt/topsters5/issues) or submit a [Pull Request](https://github.com/insane-catt/topsters5/pulls).

バグ報告や機能提案など、開発のお手伝いをしてくださる方を歓迎します。お気軽に [Issue](https://github.com/insane-catt/topsters5/issues) や [Pull Request](https://github.com/insane-catt/topsters5/pulls) をお送りください。

---

## Changes from the original / 変更点

- **Mobile support / モバイル対応**: The UI has been made responsive so charts can be created and edited on smartphones and tablets. スマートフォンやタブレットでもチャートを作成・編集できるように、UI をレスポンシブ対応にしました。
- **Last.fm search / Last.fm 検索**: The search engine has been switched to use Last.fm. 検索エンジンを Last.fm を使用するものに変更しました。
- **100-tile collage layout / 100枚コラージュレイアウト**: Tile size tiers are tuned for 100-tile charts so each tier spans a consistent number of rows. 100枚設定時のタイルサイズ段階を調整し、各サイズが均等な行数になるようにしました。


---

## Importing from RateYourMusic / RateYourMusic からのインポート

RYM now downloads your data as a CSV file directly, so importing is simple:

1. Go to the bottom of your RYM profile and click the "Export your music catalog" button. A CSV file will be downloaded automatically.
2. Go to Import->from RateYourMusic and select the downloaded CSV file.

You should see covers for your top rated albums start to load up. You may have to rearrange things or replace a couple covers but it should at least save you some time searching.

RYM の仕様が変わり、データが CSV ファイルとして直接ダウンロードされるようになったため、インポートは簡単です。

1. RYM プロフィールページの一番下にある「Export your music catalog」ボタンをクリックします。CSV ファイルが自動的にダウンロードされます。
2. Import → from RateYourMusic を開き、ダウンロードした CSV ファイルを選択します。

高評価のアルバムのカバー画像が読み込まれ始めるはずです。並べ替えたり、いくつかのカバーを差し替えたりする必要があるかもしれませんが、少なくとも検索の手間は省けるはずです。
