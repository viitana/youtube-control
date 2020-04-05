
const videos = {}

const updateStatus = video => {
  if (videos[video.id] == null) videos[video.id] = video
  else Object.assign(videos[video.id], video)

  console.log(`Received update for video ID ${video.id}, new state`, videos)
}

chrome.runtime.onConnect.addListener(port => {
  port.onMessage.addListener(msg => {
    if (msg.type == "update") updateStatus(msg.video)
  });
});

console.log("Opening native messaging port")
const server = chrome.runtime.connectNative('net.viitana.youtubecontrolserver');

server.onMessage.addListener(msg => {
  console.log("Received native message:" + msg);
});

server.onDisconnect.addListener(() => {
  console.log("Disconnected server");
});

// Send ititial message
server.postMessage({
  type: "init",
  data: "localhost:2277",
});
