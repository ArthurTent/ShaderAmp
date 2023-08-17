// Receive data from Option Tab or Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, data } = request;

  switch (type) {
    case "FROM_OPTION":
      console.log("FROM_OPTION")
      console.log(data);
      break;
    default:
      console.log("default");
      break;
  }

  sendResponse({});
});
