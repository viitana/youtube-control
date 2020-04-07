var video = null
var bgScriptPort = null

// Get unique video id from URL
const id_re = /watch\?v=(.{11})/
const id_re_result = document.location.href.match(id_re)
const id = id_re_result.length > 1 ? id_re_result[1] : ""

const start = evt => {
  video = document.querySelector('video');

  var doc_title_elem = document.querySelector('title');
  
  if (doc_title_elem != null) {
    var observer = new MutationObserver( mutations => {
      handleTitleChange(mutations[0].target.text)
    });
    observer.observe(doc_title_elem,  { childList: true });
  }
  
  if (video != null) {
    console.log(`Opening port "${id} to background script"`)
    bgScriptPort = chrome.runtime.connect({ name: id });

    bgScriptPort.postMessage({
      type: "update",
      video:{
        id: id,
        duration: video.duration,
        current: video.currentTime,
        muted: video.muted,
        paused: video.paused,
        ended: video.ended,
        url: document.location.href,
      },
    });

    bgScriptPort.onMessage.addListener(msg => {
      console.log("Received background script message:", msg)
    });
  }
}

const handleTitleChange = newTitle => {
  if (bgScriptPort != null && newTitle != null && newTitle.length > 6) {
    console.log("Sending title update: ", newTitle)
    bgScriptPort.postMessage({
      type: "update",
      video:{
        id: id,
        title: newTitle,
      }
    })
  }
}

setInterval(() => {
  videoInfo()
}, 1000)

const videoInfo = () => {
  if (video != null) console.log(video.duration, video.currentTime, video.muted, video.paused)
}

document.addEventListener('readystatechange', start);
