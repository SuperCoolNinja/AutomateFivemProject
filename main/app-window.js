const { BrowserWindow } = require("electron");

function createMainWindow({ width, height }) {
  const mainWindow = new BrowserWindow({
    width: width,
    height: height,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  return mainWindow;
}

module.exports = {
  createMainWindow,
};
