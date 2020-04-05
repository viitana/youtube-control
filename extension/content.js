var video = null

const start = evt => {
  video = document.querySelector('video');

  if (video != null) {
    // Get unique video id from URL
    const id = window.location.href.slice(-11)

    console.log(`Opening port "${id} to background script"`)
    var port = chrome.runtime.connect({ name: id });

    port.postMessage({
      type: "update",
      video:{
        id: id,
        url: document.location.href,
      },
    });

    port.onMessage.addListener(msg => {
      console.log("Received background script message:", msg)
    });
  }
}

document.addEventListener('readystatechange', start);
