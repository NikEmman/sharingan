chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "show-notification") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/sharingan-48.png",
      title: "Extension Error",
      message: message.text,
    });
  }
});
