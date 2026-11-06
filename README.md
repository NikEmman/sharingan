# sharingan

A browser extension that saves the current tab as numbered **steps**: the page
and every frame inside it, with what you typed or picked kept in the HTML.
Useful for recording a multi-step flow in a web app to work on it offline.

## 📦 Installation Instructions (Developer Mode)

### 🧭 Chrome & Chromium-based Browsers (Brave, Edge, Opera)

1. Open your browser and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the folder where you downloaded and unzipped the extension files
5. The extension will now appear in your extensions list and be active

### 🦊 Firefox

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file from your extension folder
4. The extension will be loaded temporarily and will work until the browser is closed

> 💡 Tip: After making changes to the extension files, click the **refresh icon** next to your extension to reload it.

---

## 🚀 How to Use

1. Click the **Extensions** icon in your browser toolbar
2. Pin **sharingan** for quick access
3. Click the **sharingan** icon to open the popup
4. Optionally set the **session folder** and a **note** for this step
5. Click **Sharingan!** after each step of the flow you are recording

Each click saves one step into `Downloads/sharingan/<session>/`:

```
01-<page title>.html                  the page
02-<page title>.html
02-frame-pf_-pfo-folder-lov.html      a frame that was open (popup, list, document…)
steps.txt                             "Download steps.txt": every step, its URL, note and files
```

- **Frames are saved too**, each as its own file (named after the frame's name
  and address). Empty frames (`about:blank`) and "Loading…" placeholders
  are skipped. In the page file each `<iframe>` gets `data-sharingan-src` with the address it actually showed.
- **Form state is kept**: typed text, checkboxes, selected options and
  textarea text are written into the HTML. "Save Page As" loses these.
  Password fields are never saved.
- **Stylesheets are embedded** (option, on by default): each `<link>` and
  `<style>` becomes a `<style>` with the rules the page loaded, `@import`s
  expanded and `url(...)` made absolute, so the file displays without the
  site. Sheets from other sites are fetched by the extension; if that fails
  the `<link>` is kept and the popup says so. Images are not embedded.
- Each file starts with a comment: step number, time, URL, frame name and note.
- The step counter and log survive closing the popup, even if it closes
  mid-capture (the step number is claimed before any file is saved).
  **New session** starts again from step 01 in a new folder.

> 📁 Files go to your default downloads folder, without a save dialog.

---

## 🛠️ Troubleshooting

- **Button not working?** Make sure the tab you're trying to copy is fully loaded.
- **Firefox: nothing is captured?** Allow the add-on to access websites (it asks on the first click, or about:addons → Sharingan → Permissions).
- **File not downloading?** Check your browser's download permissions or try reloading the extension.
- **Firefox users:** Remember that the extension is temporary and will disappear after restarting the browser.

---

> 💡 Pro Tip: As you are clicking the button to perform the copy, yell **Sharingan** for extra effect!

---

## 📄 License

MIT License — feel free to use, modify, and share.
