
const videos = {}

const updateStatus = video => {
  if (videos[video.id] == null) videos[video.id] = video
  else Object.assign(videos[video.id], video)

  console.log(`Received update for video ID ${video.id}, new state`, videos)
}

const handleMessage = msg => {
  switch (msg.type) {
    case "update":
      updateStatus(msg.video)
  }
}

chrome.runtime.onConnect.addListener(port => {
  port.onMessage.addListener(msg => {
    handleMessage(msg)
  });
});



console.log("Opening native messaging port")
const server = chrome.runtime.connectNative('net.viitana.youtubecontrolserver');

const handleNativeMessage = msg => {
  switch (msg.type) {
    case "get_state":
      server.postMessage({
        type: msg.type,
        data: videos,
        address: msg.address,
      })
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
