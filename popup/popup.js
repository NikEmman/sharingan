// popup/popup.js
document.getElementById("copy").addEventListener("click", async () => {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) throw new Error("No active tab");

    // Inject code to get full page HTML
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML,
    });

    const html = results[0].result;
    if (!html) throw new Error("Empty HTML");

    // Create blob URL (works in popup context)
    const blob = new Blob([html], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    // Create temporary link and trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = "page-source.txt";
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (err) {
    alert("Error: " + err.message);
    console.error("Kagebunshin error:", err);
  }
});
