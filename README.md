# Topsters5

> **Work in Progress** — This is an unofficial development preview. No formal release has been made yet.

A fork of [GiraffeKey's ChartYourMusic](https://github.com/GiraffeKey/chartyourmusic), with added mobile support and other improvements.

The development preview is available [here](https://insane-catt.github.io/chartyourmusic/).

## Changes from the original

- **Mobile scroll**: Swipe anywhere in the chart area to scroll — tiles no longer capture the gesture
- **Long-press drag on mobile**: Hold a tile for ~400ms to pick it up and drag it into a new position; a quick swipe scrolls instead
- **Vertical scroll for large charts**: Charts with many tiles scroll vertically within the chart area without resizing the layout
- **100-tile collage layout**: Tile size tiers are tuned for 100-tile charts so each tier spans a consistent number of rows

## Importing from RateYourMusic

The RYM import functionality can be a little tricky to work with (blame them for it). These steps should help you figure out what to do:

1. Go to the bottom of your RYM profile and click the "Export your data" button.
2. Press CTRL+A CTRL+C to copy all of the text.
3. Create a file on your computer named "rym.csv" and paste the text in it.
4. Go to Import->from RateYourMusic and select the file.

You should see covers for your top rated albums start to load up. You may have to rearrange things or replace a couple covers but it should at least save you some time searching.
