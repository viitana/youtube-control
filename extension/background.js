const videos = {}
const tabs = {}
const details = {}

// API endpoint for video details
const getDetailsURL = id => `http://www.youtube.com/get_video_info?video_id=${id}`

// Process querystrings from video details API response to a dict
const parseQueryStrings = data => {
  var mapping = {};
	data.split('&').forEach(function(entry) {
		mapping[
				decodeURIComponent(entry.substring(0, entry.indexOf('=')))] =
				decodeURIComponent(entry.substring(entry.indexOf('=') + 1));
  });
	return mapping;
};

// Prosess and parse a video details API response
const parseVideoDetails = raw => {
  data = parseQueryStrings(raw);
  if (!data || !data.player_response) return null
  return obj = JSON.parse(data.player_response)
}

// Start up & launch native messaging host (server)
console.log("Opening native messaging port")
const server = chrome.runtime.connectNative('net.viitana.youtubecontrolserver');

// Send out current video state information to native host
const postToNativeHost = overrides => {
  var data = {
    type: "update",
    data: videos,
    timestamp: new Date().getTime(),
  }
  if (overrides) data = Object.assign(data, overrides)
  server.postMessage(data)
}

// Client requesting update
const handleNativeMessage = msg => {
  switch (msg.type) {
    case "get_state":
      postToNativeHost({ address: msg.address })
  }
}

server.onMessage.addListener(msg => {
  console.log("Received native message:", msg);
  handleNativeMessage(msg)
});

server.onDisconnect.addListener(() => {
  console.log("Native host disconnected.");
});

// Send an itit message to native host
server.postMessage({
  type: "init",
  data: "0.0.0.0:2277",
});

// Queue an API request for additional video information
const fetchDetails = (msg, tabID) => {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", getDetailsURL(msg.video.id), true);
  xhr.onreadystatechange = () => {
    if (xhr.readyState == 4) {
      // When done, update video state & post an update to native host
      const data = parseVideoDetails(xhr.response)
      if (data == null) return
      details[tabID] = true

      updateStatus({
        video: {
          id: data.videoDetails.videoId,
          title: data.videoDetails.title.replace(/\+/g, ' '),
          rating: data.videoDetails.averageRating,
          viewcount: data.videoDetails.viewCount,
          channel: data.videoDetails.author,
          thumbnails: data.videoDetails.thumbnail.thumbnails,
        }
      }, tabID)
      postToNativeHost()
    }
  }
  xhr.send();
}

const updateStatus = (msg, tabID) => {
  if (msg.force) {
    console.log("Force reset for tab " + tabID)
    delete videos[tabID]
    delete details[tabID]
  }

  if (videos[tabID] == null) videos[tabID] = msg.video
  else videos[tabID] = Object.assign(videos[tabID], msg.video)

  if (!details[tabID]) {
    fetchDetails(msg, tabID)
  }
  
  if (msg.video.title) console.log(`Detail update for tab ID ${tabID} (${msg.video.id}), fetching details: ${!Boolean(details[tabID])}, title ${msg.video.title}, new state:`, videos)
  else console.log(`Normal update for tab ID ${tabID} (${msg.video.id}), fetching details: ${!Boolean(details[tabID])}, new state:`, videos)
}

// Respond to a tab message
const handleMessage = (msg, tabID) => {
  if (msg.type == "update") {
    updateStatus(msg, tabID)
    postToNativeHost()
  }
}

// Add listeners to any connecting tabs
chrome.runtime.onConnect.addListener(port => {
  port.onMessage.addListener((msg, senderInfo, sendResPonse) => {
    handleMessage(msg, senderInfo.sender.tab.id)
  });
});

// Remove video state data when a tab closes
chrome.tabs.onRemoved.addListener(tabID => {
  if (videos[tabID]) {
    delete videos[tabID]
    delete details[tabID]
    postToNativeHost()
  }
})
