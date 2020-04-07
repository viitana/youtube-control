const videos = {}
const tabs = {}
const details = {}

const getDetailsURL = id => `http://www.youtube.com/get_video_info?video_id=${id}`


const parseQueryStrings = data => {
  var mapping = {};
	data.split('&').forEach(function(entry) {
		mapping[
				decodeURIComponent(entry.substring(0, entry.indexOf('=')))] =
				decodeURIComponent(entry.substring(entry.indexOf('=') + 1));
  });
	return mapping;
};

const parseVideoDetails = raw => {
  data = parseQueryStrings(raw);
  if (!data || !data.player_response) return null
  return obj = JSON.parse(data.player_response)
}

console.log("Opening native messaging port")
const server = chrome.runtime.connectNative('net.viitana.youtubecontrolserver');

// Client requesting update
const handleNativeMessage = msg => {
  switch (msg.type) {
    case "get_state":
      const nativemsg = {
        type: "update",
        data: videos,
        address: msg.address,
        timestamp: new Date().getTime(),
      }
      console.log("sending to server:", nativemsg)
      server.postMessage(nativemsg)
  }
}

server.onMessage.addListener(msg => {
  console.log("Received native message:", msg);
  handleNativeMessage(msg)
});

server.onDisconnect.addListener(() => {
  console.log("Disconnected server");
});

// Send ititial message
server.postMessage({
  type: "init",
  data: "0.0.0.0:2277",
});

const fetchDetails = (msg, tabID) => {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", getDetailsURL(msg.video.id), true);
  xhr.onreadystatechange = () => {
    if (xhr.readyState == 4) {
      const details = parseVideoDetails(xhr.response)
      if (details == null) return

      updateStatus({
        video: {
          title: details.videoDetails.title.replace(/\+/g, ' '),
          rating: details.videoDetails.averageRating,
          viewcount: details.videoDetails.viewCount,
          channel: details.videoDetails.author,
          thumbnails: details.videoDetails.thumbnail.thumbnails,
        }
      }, tabID)

      details[tabID] = true
    }
  }
  xhr.send();
}

const updateStatus = (msg, tabID) => {
  if (videos[tabID] == null) videos[tabID] = msg.video
  else Object.assign(videos[tabID], msg.video)

  if (!details[tabID]) {
    fetchDetails(msg, tabID)
  }
  console.log(`Received update from tab ID ${tabID} (${msg.video.id}), fetching details: ${!Boolean(details[tabID])}, new state:`, videos)
}

const handleMessage = (msg, tabID) => {
  switch (msg.type) {
    case "update":
      updateStatus(msg, tabID)
      server.postMessage({
        type: "update",
        data: videos,
        timestamp: new Date().getTime(),
      })
  }
}

chrome.runtime.onConnect.addListener(port => {
  // Tab has sent update
  port.onMessage.addListener((msg, senderInfo, sendResPonse) => {
    handleMessage(msg, senderInfo.sender.tab.id)
  });
});

// Tab closed
chrome.tabs.onRemoved.addListener(id => {
  if (videos[id]) {
    delete videos[id]
    delete details[id]
    server.postMessage({
      type: "update",
      data: videos,
      timestamp: new Date().getTime(),
    })
  }
})
