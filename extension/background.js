const videos = {}
const tabs = {}

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

const updateStatus = (msg, tabID) => {
  if (videos[tabID] == null) videos[tabID] = msg.video
  else Object.assign(videos[tabID], msg.video)
  console.log(`Received update from tab ID ${tabID} (${msg.video.id}), new state:`, videos)
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
    console.log(msg, senderInfo, sendResPonse)
    handleMessage(msg, senderInfo.sender.tab.id)
  });
});

// Tab closed
chrome.tabs.onRemoved.addListener(id => {
  if (videos[id]) {
    delete videos[id]
    server.postMessage({
      type: "update",
      data: videos,
      timestamp: new Date().getTime(),
    })
  }
})
