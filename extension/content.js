var video = null
var backgroundPort = null

// Get unique video id from URL
const id_re = /watch\?v=(.{11})/
var id = ""

const refreshID = () => {
  const id_re_result = document.location.href.match(id_re)
  id = id_re_result.length > 1 ? id_re_result[1] : ""
}

refreshID()

// Update background on current video status
const postUpdate = overrides => {
  var data = {
    type: "update",
    video: {
      id: id,
      current_timestamp: new Date().getTime(),
      url: document.location.href,
  
      //title: document.title.slice(0, -10),
      duration: video.duration,
      current: video.currentTime,
      muted: video.muted,
      paused: video.paused,
      ended: video.ended,
    },
  }
  if (overrides) data = Object.assign(data, overrides)
  console.log("Posting update:", data)
  backgroundPort.postMessage(data)
}

// Reset background video status for this tab and do a new update
const forcePostUpdate = () => {
  refreshID()
  postUpdate({ force: true })
}

// Ran when document is ready
const start = evt => {
  video = document.querySelector('video');

  if (video != null) {
    console.log(`Opening port "${id} to background script"`)
    backgroundPort = chrome.runtime.connect({ name: id });

    // Post an initial update
    postUpdate()

    // Add listeners for video state changes
    video.addEventListener("seeked", postUpdate)
    video.addEventListener("pause", postUpdate)
    video.addEventListener("play", postUpdate)
    video.addEventListener("playing", postUpdate)
    video.addEventListener("seeked", postUpdate)

    video.addEventListener("loadstart", forcePostUpdate)

    backgroundPort.onMessage.addListener(msg => {
      console.log("Received background script message:", msg)
    });
  }
}

document.addEventListener('readystatechange', start);
