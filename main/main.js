const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const { createMainWindow } = require("./app-window");
const { initializeIpcHandlers } = require("./ipc-handlers");
const { globalConfig } = require("./app-config.js");
const { downloadFiveMArtifacts } = require("../utils/download");

let mainWindow;

function createWindow() {
  const mainScreen = screen.getPrimaryDisplay();
  const { width, height } = mainScreen.size;
  mainWindow = createMainWindow({ width, height });
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.on(
  "generate",
  async (
    event,
    license,
    bLocalMode,
    title,
    projectName,
    projectDescription,
    launcherOptions
  ) => {
    globalConfig.licenseKey = license || "none";
    globalConfig.isLocalModeEnabled = bLocalMode;
    globalConfig.title = title || "FXServer Title";
    globalConfig.project_name = projectName || "FXServer Project Name";
    globalConfig.project_description =
      projectDescription ||
      "Description to change. FXServer generated with AutomateFivemProject by SuperCoolNinja.";
    globalConfig.launcherOptions = launcherOptions;

    const statusUpdate = (message) => {
      event.sender.send("status-update", message);
    };

    await downloadFiveMArtifacts(statusUpdate);
  }
);

initializeIpcHandlers(ipcMain, globalConfig);
