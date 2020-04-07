var video = null
var bgScriptPort = null

// Get unique video id from URL
const id_re = /watch\?v=(.{11})/
const id_re_result = document.location.href.match(id_re)
const id = id_re_result.length > 1 ? id_re_result[1] : ""

// Update background on current video status
const postUpdate = overrides => {
  const baseInfo = {
    id: id,
    current_timestamp: new Date().getTime(),
    url: document.location.href,

    title: document.title.slice(0, -10),
    duration: video.duration,
    current: video.currentTime,
    muted: video.muted,
    paused: video.paused,
    ended: video.ended,
  }
  bgScriptPort.postMessage({
    type: "update",
    video: baseInfo,
  })
}

const start = evt => {
  video = document.querySelector('video');

  var doc_title_elem = document.querySelector('title');
  
  if (doc_title_elem != null) {
    var observer = new MutationObserver(postUpdate);
    observer.observe(doc_title_elem,  { childList: true });
  }
  
  if (video != null) {
    console.log(`Opening port "${id} to background script"`)
    bgScriptPort = chrome.runtime.connect({ name: id });

    postUpdate()

    bgScriptPort.onMessage.addListener(msg => {
      console.log("Received background script message:", msg)
    });

    video.addEventListener("seeked", evt => postUpdate)

    video.addEventListener("pause", evt => postUpdate)

    video.addEventListener("play", postUpdate)

    video.addEventListener("playing", postUpdate)

    video.addEventListener("seeked", postUpdate)
  }
}

setInterval(() => {
  videoInfo()
}, 1000)

const videoInfo = () => {
  if (video != null) console.log(video.duration, video.currentTime, video.muted, video.paused)
}

document.addEventListener('readystatechange', start);
