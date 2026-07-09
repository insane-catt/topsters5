# Topsters5

> **Work in Progress** — This is an unofficial development preview. No formal release has been made yet.
>
> **開発中** — 非公式のプレビュー版です。正式リリースはまだ行っていません。

A fork of [GiraffeKey's ChartYourMusic](https://github.com/GiraffeKey/chartyourmusic), with added mobile support and other improvements.

[GiraffeKey の ChartYourMusic](https://github.com/GiraffeKey/chartyourmusic) をベースに、モバイル対応などの改善を加えたフォークです。

The development preview is available here / 開発中プレビューはこちら: <https://topsters5.vercel.app/>

---

## Changes from the original / 変更点

- **Mobile scroll / モバイルスクロール**: Swipe anywhere in the chart area to scroll — tiles no longer capture the gesture. チャートエリアをスワイプするとスクロールできます。タイルがジェスチャーを横取りしません。
- **Long-press drag on mobile / 長押しドラッグ**: Hold a tile for ~400ms to pick it up and drag it to a new position; a quick swipe scrolls instead. タイルを約400ms長押しするとドラッグで並び替えられます。素早いスワイプはスクロールになります。
- **Vertical scroll for large charts / 縦スクロール対応**: Charts with many tiles scroll vertically within the chart area without resizing the layout. タイル数が多いチャートはレイアウトを崩さず縦スクロールできます。
- **100-tile collage layout / 100枚コラージュレイアウト**: Tile size tiers are tuned for 100-tile charts so each tier spans a consistent number of rows. 100枚設定時のタイルサイズ段階を調整し、各サイズが均等な行数になるようにしました。

---

## Importing from RateYourMusic

The RYM import functionality can be a little tricky to work with (blame them for it). These steps should help you figure out what to do:

1. Go to the bottom of your RYM profile and click the "Export your data" button.
2. Press CTRL+A CTRL+C to copy all of the text.
3. Create a file on your computer named "rym.csv" and paste the text in it.
4. Go to Import->from RateYourMusic and select the file.

You should see covers for your top rated albums start to load up. You may have to rearrange things or replace a couple covers but it should at least save you some time searching.
