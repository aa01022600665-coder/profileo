# Auto Click Text Recorder

A small Chrome/Edge extension that records clicks and typed text on normal webpages, saves the recording locally, exports it as a `.txt` file, and replays it later.

## Install

1. Open `chrome://extensions` or `edge://extensions`.
2. Turn on `Developer mode`.
3. Choose `Load unpacked`.
4. Select this folder, or the clean release folder:

   `C:\Users\bajra\OneDrive\Documents\ChatGPT\auto click`

   `C:\Users\bajra\OneDrive\Documents\ChatGPT\auto click\release\INSTALL_THIS_AUTO_CLICK`

The extension now includes toolbar icons and a Chrome Side Panel entry, similar to Nexus Wallet.

## Use

1. Open the webpage you want to automate.
2. Click the `AUTO` tab on the left side of the page, or click the extension icon.
3. Press `Record`.
4. Click and type on the page.
5. Press `Stop`.
6. Press `Play` to replay, or `Export TXT` to save the recording.

Use `Import TXT` to load a recording back into the extension.

If the `AUTO` tab does not show, reload the webpage after loading or reloading the extension.

## One-click search mode

For a search box, you can record only the click once, or record several setup clicks first:

1. Press `Record`.
2. Click inside the search box, or record the full setup sequence.
3. Press `Stop`.
4. Type or import TXT lines in `TXT lines`, one item per line.
5. Keep `Enter after text` checked.
6. Press `Play`.

On playback, the extension runs the recorded actions first. Then it types each `TXT lines` item, presses Enter, waits the `Line delay` time, and continues until every line is finished. Plain `.txt` files imported with `Import TXT` are loaded into `TXT lines`.

## Notes

- Password field values are skipped.
- Browser extensions cannot move the real system mouse or control apps outside the browser.
- Chrome internal pages like `chrome://extensions` do not allow content scripts.
- Some websites block synthetic clicks or text events. Those pages may need custom automation code.
