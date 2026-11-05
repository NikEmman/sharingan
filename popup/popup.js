// popup/popup.js
//
// Each click saves one numbered "step" of the current tab:
//   sharingan/<session>/03-<page title>.html          the top page
//   sharingan/<session>/03-frame-<name>-<url>.html     every frame with content
// Saved HTML keeps what the user typed or picked (input values, checkboxes,
// selected options, textarea text), which "Save Page As" and plain outerHTML
// lose, and (optionally) embeds the page's stylesheets so it displays offline. A per-session log of all steps can be downloaded as steps.txt.

const $ = id => document.getElementById(id);
const sessionInput = $("session");
const noteInput    = $("note");
const stepEl       = $("step");
const statusEl     = $("status");
const copyBtn      = $("copy");
const logBtn       = $("log");
const newBtn       = $("new-session");
const cssInput     = $("embed-css");

// ─── State (chrome.storage.local, survives the popup closing) ────────────────
//   session: folder name under Downloads/sharingan/
//   step:    number of the next capture
//   log:     [{ step, time, title, url, files: [...], note }]
let state = { session: "", step: 1, log: [], embedCss: true };

const stamp = () => {
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
};

async function load() {
  const s = await chrome.storage.local.get(["session", "step", "log", "embedCss"]);
  state = { session: s.session || stamp(), step: s.step || 1, log: s.log || [], embedCss: s.embedCss !== false };
  render();
}

const save = () => chrome.storage.local.set(state);

function render() {
  sessionInput.value = state.session;
  cssInput.checked   = state.embedCss;
  stepEl.textContent = `Next step: ${String(state.step).padStart(2, "0")}`;
  logBtn.disabled = state.log.length === 0;
}

const setStatus = (text, kind = "") => {
  statusEl.textContent = text;
  statusEl.className = kind;
};

// ─── File names ──────────────────────────────────────────────────────────────
// Keep letters of any language; drop characters that are illegal in file names.
function safeName(s, max = 80) {
  return String(s)
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim() || "page";
}

// The last meaningful part of a frame's URL: ".../prot_beta/pfo-folder-lov?x=1" → "pfo-folder-lov"
function urlPart(url) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() || u.hostname || u.protocol;
    return last.replace(/\.html?$/i, "");
  } catch (_) {
    return "frame";
  }
}

// ─── Capture (runs inside every frame of the tab) ────────────────────────────
// Returns the frame's HTML with live form state written into the markup.
// Works on a clone, so the page itself is never changed.
function capturePage(embedCss) {
  const live  = document.documentElement;
  const clone = live.cloneNode(true);

  // Make url(...) inside CSS absolute, so it still works from a saved file.
  const absUrls = (css, base) => css.replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/g, (m, q, u) => {
    if (!u || /^(data:|[a-z][a-z0-9+.-]*:|#)/i.test(u)) return m;
    try { return `url("${new URL(u, base).href}")`; } catch (_) { return m; }
  });
  // A sheet's rules as text, @import-ed sheets expanded in place.
  // Throws for a cross-origin sheet (rules not readable from the page).
  const sheetText = sheet => {
    const base = sheet.href || document.baseURI;
    return Array.from(sheet.cssRules, r => {
      if (r.type === CSSRule.IMPORT_RULE && r.styleSheet) {
        let inner;
        try { inner = sheetText(r.styleSheet); } catch (_) { return absUrls(r.cssText, base); }
        const media = r.media?.mediaText;
        return media ? `@media ${media} {\n${inner}\n}` : inner;
      }
      return absUrls(r.cssText, base);
    }).join("\n");
  };
  const styleTag = (css, attrs) =>
    `<style${attrs}>\n${css.replace(/<\/style/gi, "<\\/style")}\n</style>`;

  // Stylesheets that could not be read here; the popup downloads them.
  const pendingCss = [];
  if (embedCss) {
    const liveNodes  = Array.from(live.querySelectorAll('link[rel~="stylesheet" i], style'));
    const cloneNodes = Array.from(clone.querySelectorAll('link[rel~="stylesheet" i], style'));
    for (const sheet of Array.from(document.styleSheets)) {
      const i = liveNodes.indexOf(sheet.ownerNode);
      const target = cloneNodes[i];
      if (i < 0 || !target) continue;
      const media = sheet.media?.mediaText ? ` media="${sheet.media.mediaText.replace(/"/g, "&quot;")}"` : "";
      const from  = sheet.href ? ` data-sharingan-from="${sheet.href.replace(/"/g, "&quot;")}"` : "";
      let html;
      try {
        html = styleTag(sheetText(sheet), media + from);
      } catch (_) {
        const n = pendingCss.length;
        pendingCss.push({ n, href: sheet.href, media });
        html = `<style data-sharingan-pending="${n}"></style>`;
      }
      const holder = document.createElement("template");
      holder.innerHTML = html;
      target.replaceWith(holder.content.firstChild);
    }
    // Stylesheets added from script (document.adoptedStyleSheets).
    for (const sheet of document.adoptedStyleSheets || []) {
      try {
        const holder = document.createElement("template");
        holder.innerHTML = styleTag(sheetText(sheet), ' data-sharingan-from="adopted"');
        (clone.querySelector("head") || clone).appendChild(holder.content.firstChild);
      } catch (_) {}
    }
  }

  const pairs = sel => {
    const a = live.querySelectorAll(sel), b = clone.querySelectorAll(sel);
    return Array.from(a, (el, i) => [el, b[i]]).filter(([, c]) => c);
  };

  for (const [el, c] of pairs("input")) {
    const type = (el.type || "").toLowerCase();
    if (type === "password") { c.removeAttribute("value"); continue; }  // never save passwords
    if (type === "file") continue;
    if (type === "checkbox" || type === "radio") c.toggleAttribute("checked", el.checked);
    else c.setAttribute("value", el.value);
  }
  for (const [el, c] of pairs("textarea")) c.textContent = el.value;
  for (const [el, c] of pairs("option")) c.toggleAttribute("selected", el.selected);

  // Remember each iframe's current address (scripts often change src after load).
  for (const [el, c] of pairs("iframe, frame")) {
    let src = el.getAttribute("src") || "";
    try { src = el.contentWindow?.location.href || src; } catch (_) { /* cross-origin */ }
    c.setAttribute("data-sharingan-src", src);
  }

  const dt = document.doctype;
  const doctype = dt
    ? `<!DOCTYPE ${dt.name}${dt.publicId ? ` PUBLIC "${dt.publicId}"` : ""}${dt.systemId ? ` "${dt.systemId}"` : ""}>\n`
    : "";
  const text = (document.body?.innerText || "").trim();

  return {
    html:   doctype + clone.outerHTML,
    title:  document.title.replace(/\s+/g, " ").trim(),
    url:    location.href,
    name:   window.name || "",
    isTop:  window === window.top,
    pendingCss,
    empty:  !text && !document.querySelector("img, input, select, textarea, table"),
  };
}

// ─── Stylesheets the page could not read (other sites) ───────────────────────
// The extension may fetch them itself (host permission). On failure the
// original <link> is put back.
function absUrls(css, base) {
  return css.replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/g, (m, q, u) => {
    if (!u || /^(data:|[a-z][a-z0-9+.-]*:|#)/i.test(u)) return m;
    try { return `url("${new URL(u, base).href}")`; } catch (_) { return m; }
  });
}

async function fillPendingCss(page) {
  let html = page.html, failed = 0;
  for (const { n, href, media } of page.pendingCss || []) {
    const tag = `<style data-sharingan-pending="${n}"></style>`;
    const attr = href.replace(/"/g, "&quot;");
    let rep;
    try {
      const res = await fetch(href, { credentials: "include" });
      if (!res.ok) throw new Error(res.status);
      const css = absUrls(await res.text(), href).replace(/<\/style/gi, "<\\/style");
      rep = `<style${media} data-sharingan-from="${attr}">\n${css}\n</style>`;
    } catch (_) {
      failed++;
      rep = `<link rel="stylesheet" href="${attr}"${media}>`;
    }
    html = html.split(tag).join(rep);
  }
  return { html, failed };
}

// ─── Download ────────────────────────────────────────────────────────────────
// Keep the blob URL alive until the download has finished.
function download(text, filename, type = "text/html") {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url  = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename, saveAs: false, conflictAction: "uniquify" }, id => {
      if (chrome.runtime.lastError || id === undefined) {
        URL.revokeObjectURL(url);
        return reject(new Error(chrome.runtime.lastError?.message || "Download failed"));
      }
      const done = d => {
        if (d.id !== id || !d.state || d.state.current === "in_progress") return;
        chrome.downloads.onChanged.removeListener(done);
        URL.revokeObjectURL(url);
        d.state.current === "complete" ? resolve() : reject(new Error("Download interrupted"));
      };
      chrome.downloads.onChanged.addListener(done);
    });
  });
}

// ─── Actions ─────────────────────────────────────────────────────────────────
copyBtn.addEventListener("click", async () => {
  // Firefox MV3: host permissions are opt-in; ask from the click (first call).
  try { await chrome.permissions.request({ origins: ["<all_urls>"] }); } catch (_) {}

  copyBtn.disabled = true;
  setStatus("Capturing…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func:   capturePage,
      args:   [cssInput.checked],
    });
    const pages = results.map(r => r?.result && { ...r.result, frameId: r.frameId }).filter(Boolean);
    const top   = pages.find(p => p.isTop || p.frameId === 0);
    if (!top?.html) throw new Error("Could not read the page");
    const frames = pages.filter(p => p !== top && !p.empty);
    let cssFailed = 0;
    for (const p of [top, ...frames]) {
      const r = await fillPendingCss(p);
      p.html = r.html;
      cssFailed += r.failed;
    }

    state.session = safeName(sessionInput.value || state.session, 60);
    const n      = String(state.step).padStart(2, "0");
    const dir    = `sharingan/${state.session}`;
    const note   = noteInput.value.trim();
    const header = p =>
      `<!-- sharingan step ${n} | ${new Date().toISOString()} | ${p.url}` +
      (p.name ? ` | frame name="${p.name}"` : "") +
      (note ? ` | note: ${note.replace(/--/g, "‐‐")}` : "") + " -->\n";

    const files = [];
    const topFile = `${n}-${safeName(top.title)}.html`;
    await download(header(top) + top.html, `${dir}/${topFile}`);
    files.push(topFile);

    const used = new Set();
    for (const f of frames) {
      const base = `${n}-frame-${safeName([f.name, urlPart(f.url)].filter(Boolean).join("-"), 60)}`;
      let name = `${base}.html`;
      for (let k = 2; used.has(name); k++) name = `${base}-${k}.html`;
      used.add(name);
      await download(header(f) + f.html, `${dir}/${name}`);
      files.push(name);
    }

    state.log.push({ step: state.step, time: new Date().toISOString(), title: top.title, url: top.url, files, note });
    state.step++;
    await save();
    noteInput.value = "";
    render();
    setStatus(`Saved step ${n}: ${files.length === 1 ? "1 file" : `${files.length} files`}` +
              (frames.length ? ` (page + ${frames.length} frame${frames.length > 1 ? "s" : ""})` : "") +
              (cssFailed ? `; ${cssFailed} stylesheet${cssFailed > 1 ? "s" : ""} could not be embedded (kept as links)` : ""),
              cssFailed ? "" : "ok");
  } catch (err) {
    console.error("Sharingan error:", err);
    setStatus(err.message || "Unknown error", "error");
    chrome.notifications?.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/sharingan-48.png"),
      title: "Sharingan Error",
      message: err.message || "An unknown error occurred while exporting the page.",
    });
  } finally {
    copyBtn.disabled = false;
  }
});

// steps.txt: one block per capture, in order — what was saved and the note.
logBtn.addEventListener("click", async () => {
  const lines = [`Sharingan session: ${state.session}`, ""];
  for (const s of state.log) {
    lines.push(`${String(s.step).padStart(2, "0")}  ${s.time}  ${s.title}`, `    ${s.url}`);
    if (s.note) lines.push(`    note: ${s.note}`);
    for (const f of s.files) lines.push(`    - ${f}`);
    lines.push("");
  }
  try {
    await download(lines.join("\n"), `sharingan/${state.session}/steps.txt`, "text/plain");
    setStatus("Saved steps.txt", "ok");
  } catch (err) {
    setStatus(err.message, "error");
  }
});

newBtn.addEventListener("click", async () => {
  state = { session: stamp(), step: 1, log: [], embedCss: state.embedCss };
  await save();
  render();
  setStatus("New session started", "ok");
});

sessionInput.addEventListener("change", async () => {
  state.session = safeName(sessionInput.value || stamp(), 60);
  await save();
  render();
});

cssInput.addEventListener("change", async () => {
  state.embedCss = cssInput.checked;
  await save();
});

load();
