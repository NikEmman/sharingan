// popup/popup.js
document.getElementById("copy").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) throw new Error("No active tab");

    // Inject code to get full page HTML
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        html: document.documentElement.outerHTML,
        title: document.title || "page-content",
      }),
    });

    const { html, title } = results[0].result;

    if (!html) throw new Error("Empty HTML");

    // Create blob URL (works in popup context)
    const blob = new Blob([html], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    // Create temporary link and trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.html`;
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (err) {
    chrome.runtime.sendMessage({
      type: "show-notification",
      text: err.message,
    });

    console.error("Kagebunshin error:", err);
  }
});
