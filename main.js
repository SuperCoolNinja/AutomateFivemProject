const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const Seven = require("node-7z");
const fetch = require("node-fetch");

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile("index.html");
};

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

ipcMain.on("generate", async (event) => {
  const statusUpdate = (message) => {
    event.sender.send("status-update", message);
  };

  downloadFiveMArtifacts(statusUpdate);
});

async function downloadAndExtractArtifact(
  artifactURL,
  serverDirectoryName,
  statusUpdate = null
) {
  try {
    // Download the artifact
    const artifactResponse = await fetch(artifactURL);
    const artifactBuffer = await artifactResponse.buffer();

    statusUpdate("Downloading...");

    // Save the artifact in the server directory
    const artifactFileName = path.basename(artifactURL);
    const artifactFilePath = path.join(
      __dirname,
      serverDirectoryName,
      artifactFileName
    );
    fs.writeFileSync(artifactFilePath, artifactBuffer);

    statusUpdate("Extracting...");

    // Extract the artifact using node-7z
    const myStream = Seven.extractFull(
      artifactFilePath,
      path.join(__dirname, serverDirectoryName)
    );
    await new Promise((resolve, reject) => {
      myStream.on("end", resolve);
      myStream.on("error", reject);
    });

    // Delete the 7z file after extraction
    fs.unlinkSync(artifactFilePath);
    statusUpdate("Process completed successfully.");
  } catch (error) {
    statusUpdate(`An error occurred: ${error.message}`);
  }
}

async function downloadFiveMArtifacts(statusUpdate) {
  try {
    const fetchOptions = {
      timeout: 5000, // Set a timeout for the fetch request
    };

    const artifactURL =
      "https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/";
    const response = await fetch(artifactURL, fetchOptions);

    if (!response.ok) {
      console.error(
        `Server response error: ${response.status} ${response.statusText}`
      );
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const links = $("a");
    const lastLink = links.eq(3); // Use last() to get the latest link
    const href = lastLink.attr("href");

    console.log("Last update found:", href);

    const serverDirectoryName = "FivemServer";

    // Check if the server directory already exists
    if (fs.existsSync(serverDirectoryName)) {
      console.error("Project directory already exists.");
      return;
    }

    fs.mkdirSync(serverDirectoryName);

    // Call the function to download and extract the artifact
    await downloadAndExtractArtifact(
      `${artifactURL}${href}`, // Combine base URL with href
      serverDirectoryName,
      statusUpdate
    );
  } catch (error) {
    console.error(`An error occurred: ${error}`);
  }
}
