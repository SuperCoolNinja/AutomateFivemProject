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

    statusUpdate("Fetch done");

    if (!artifactResponse.ok) {
      statusUpdate(`HTTP error! Status: ${artifactResponse.status}`);
      throw new Error(`HTTP error! Status: ${artifactResponse.status}`);
    }

    const artifactBuffer = await artifactResponse.buffer();

    statusUpdate("Downloading...");

    // Save the artifact to the FivemServer directory
    const artifactFileName = path.basename(artifactURL);
    const fivemServerPath = path.join(process.cwd(), serverDirectoryName);
    const artifactFilePath = path.join(fivemServerPath, artifactFileName);
    fs.writeFileSync(artifactFilePath, artifactBuffer);

    // Set the extraction path
    const extractPath = path.join(process.cwd(), serverDirectoryName);
    const sevenZipPath = sevenBin.path7za;

    statusUpdate(`7zPATH: ${sevenZipPath}\nartifactFilePath: ${artifactFilePath}\nExtractPath: ${extractPath}`);

    // Use 7zip-bin to extract the artifact
    const extractionCommand = `"${sevenZipPath}" x "${artifactFilePath}" -o"${extractPath}" -r`;

    // try {
    //   statusUpdate("Extracting...");
    //   childProcess.execSync(extractionCommand);
    //   statusUpdate("Extraction completed.");
    // } catch (extractionError) {
    //   console.error(`Extraction Error: ${extractionError}`);
    //   statusUpdate(`Extraction Error: ${extractionError.message}`);
    // }

    // // Create a server.cfg file
    // statusUpdate("Creating server.cfg...");
    // await createServerCfgFile(serverDirectoryName, statusUpdate);

    // // Clone cfx-server-data files from GitHub
    // statusUpdate("Cloning cfx-server-data from GitHub...");
    // await cloneGitHubRepo(serverDirectoryName, statusUpdate);

    // statusUpdate("Process completed successfully.");
  } catch (error) {
    statusUpdate(`An error occurred: ${error.message}`);
  }
}


async function cloneGitHubRepo(serverDirectoryName, statusUpdate) {
  try {
    const repoUrl = "https://github.com/citizenfx/cfx-server-data.git";
    const fivemServerPath = path.join(process.cwd(), serverDirectoryName);

    // Clone the GitHub repository into a temporary directory
    const tempPath = path.join(process.cwd());
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
    const serverCfgTemplatePath = path.join(
      process.cwd(),
      "server.cfg.template"
    );
    const serverCfgContent = fs.readFileSync(serverCfgTemplatePath, "utf-8");

    // Set the path for the local server.cfg file
    const serverCfgFilePath = path.join(
      process.cwd(),
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

    fs.mkdirSync(path.join(process.cwd(), serverDirectoryName), {
      recursive: true,
    });

    // Call the function to download and extract the artifact
    await downloadAndExtractArtifact(
      `${artifactURL}${href}`,
      serverDirectoryName,
      statusUpdate
    );
  } catch (error) {
    statusUpdate(`An error occurred: ${error}`);
    console.error(`An error occurred: ${error}`);
  }
}
