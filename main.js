const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const fse = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");
const sevenBin = require("7zip-bin");
const fetch = require("node-fetch");
const simpleGit = require("simple-git");
const childProcess = require("child_process");

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

  // Call the function to download and extract artifacts
  await downloadFiveMArtifacts(statusUpdate);
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

    // Save the artifact to the server directory
    const artifactFileName = path.basename(artifactURL);
    const artifactFilePath = path.join(
      __dirname,
      serverDirectoryName,
      artifactFileName
    );
    fs.writeFileSync(artifactFilePath, artifactBuffer);

    statusUpdate("Extracting...");

    // Use 7zip-bin to extract the artifact
    const extractPath = path.join(__dirname, serverDirectoryName);
    const sevenZipPath = sevenBin.path7za;
    const extractionCommand = `"${sevenZipPath}" x "${artifactFilePath}" -o"${extractPath}" -r`;
    childProcess.execSync(extractionCommand);

    // Delete the 7z file after extraction
    fs.unlinkSync(artifactFilePath);

    // Create a server.cfg file
    statusUpdate("Creating server.cfg...");
    await createServerCfgFile(serverDirectoryName, statusUpdate);

    // Clone cfx-server-data files from GitHub
    statusUpdate("Cloning cfx-server-data from GitHub...");
    await cloneGitHubRepo(serverDirectoryName, statusUpdate);

    statusUpdate("Process completed successfully.");
  } catch (error) {
    statusUpdate(`An error occurred: ${error.message}`);
  }
}

async function cloneGitHubRepo(serverDirectoryName, statusUpdate) {
  try {
    const repoUrl = "https://github.com/citizenfx/cfx-server-data.git";
    const fivemServerPath = path.join(__dirname, serverDirectoryName);

    // Clone the GitHub repository into a temporary directory
    const tempPath = path.join(__dirname);
    const git = simpleGit(tempPath);
    await git.clone(repoUrl);

    statusUpdate("GitHub repository cloned successfully.");

    // Move the contents of the child folder (e.g., "cfx-server-data") into FivemServer
    const childRepoPath = path.join(tempPath, "cfx-server-data");
    const childRepoContents = await fs.promises.readdir(childRepoPath);
    for (const item of childRepoContents) {
      const srcPath = path.join(childRepoPath, item);
      const destPath = path.join(fivemServerPath, item);
      await fse.move(srcPath, destPath, { overwrite: true });
    }

    // Remove the temporary directory
    await fse.remove(childRepoPath);

    statusUpdate("Child repository contents moved to FivemServer.");
  } catch (error) {
    statusUpdate(
      `An error occurred while cloning and moving the GitHub repository: ${error}`
    );
  }
}

async function createServerCfgFile(serverDirectoryName, statusUpdate) {
  try {
    // Read the content of the server.cfg.template
    const serverCfgTemplatePath = path.join(__dirname, "server.cfg.template");
    const serverCfgContent = fs.readFileSync(serverCfgTemplatePath, "utf-8");

    // Set the path for the local server.cfg file
    const serverCfgFilePath = path.join(
      __dirname,
      serverDirectoryName,
      "server.cfg"
    );

    // Write the content of the local server.cfg file using the template content
    fs.writeFileSync(serverCfgFilePath, serverCfgContent);

    statusUpdate("server.cfg created successfully.");
  } catch (error) {
    statusUpdate(`An error occurred: ${error.message}`);
  }
}

async function downloadFiveMArtifacts(statusUpdate) {
  try {
    const fetchOptions = {
      timeout: 5000, // Set a timeout limit for the fetch request
    };

    const artifactURL =
      "https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/";
    const response = await fetch(artifactURL, fetchOptions);

    if (!response.ok) {
      statusUpdate(
        `Server response error: ${response.status} ${response.statusText}`
      );
      console.error(
        `Server response error: ${response.status} ${response.statusText}`
      );
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const links = $("a");
    const lastLink = links.eq(3); // Use last() to get the most recent link
    const href = lastLink.attr("href");

    // console.log("Last update found:", href);

    const serverDirectoryName = "FivemServer";

    // Check if the server directory already exists
    if (fs.existsSync(serverDirectoryName)) {
      statusUpdate(`Project directory already exists.`);
      return;
    }

    fs.mkdirSync(serverDirectoryName);

    // Call the function to download and extract the artifact
    await downloadAndExtractArtifact(
      `${artifactURL}${href}`, // Combine the base URL with href
      serverDirectoryName,
      statusUpdate
    );
  } catch (error) {
    statusUpdate(`An error occurred: ${error}`);
    console.error(`An error occurred: ${error}`);
  }
}
