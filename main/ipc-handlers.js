const { globalConfig } = require("./app-config");

function initializeIpcHandlers(ipcMain) {
  ipcMain.on("updateLinks", (event, selectedValue) => {
    globalConfig.artifact_version = selectedValue;
    console.log("New links value:", selectedValue);
  });
}

module.exports = {
  initializeIpcHandlers,
};
