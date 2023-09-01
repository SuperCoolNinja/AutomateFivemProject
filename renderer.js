const { ipcRenderer } = require("electron");

const generateButton = document.getElementById("generateButton");
const statusText = document.getElementById("statusText");

generateButton.addEventListener("click", () => {
  ipcRenderer.send("generate");
  statusText.textContent = "Generating...";
});

ipcRenderer.on("status-update", (event, message) => {
  statusText.textContent = message;
});
