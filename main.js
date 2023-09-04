const { app, BrowserWindow, ipcMain, screen  } = require("electron");
const fs = require("fs");
const fse = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");
const sevenBin = require("7zip-bin");
const fetch = require("node-fetch");
const simpleGit = require("simple-git");
const childProcess = require("child_process");

let mainWindow;
let artifact_version = 1; // ARTIFACT VERSION. 1 = master 3 = latest version.
let licenseKey = "";
let isLocalModeEnabled = false;
const serverDirectoryName = "FivemServer";

const createWindow = () => {
  const mainScreen = screen.getPrimaryDisplay();
  const { width, height } = mainScreen.size;
  mainWindow = new BrowserWindow({
    width: width,
    height: height,
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

ipcMain.on("generate", async (event, license, bLocalMode) => {
  const statusUpdate = (message) => {
    event.sender.send("status-update", message);
  };

  licenseKey = license;
  isLocalModeEnabled = bLocalMode;

  console.log(bLocalMode);

  // Call the function to download and extract artifacts
  await downloadFiveMArtifacts(statusUpdate);
});

ipcMain.on("updateLinks", (event, selectedValue) => {
  artifact_version = selectedValue;
  console.log("New links value:", artifact_version);
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
    // Obtenir le chemin vers app.asar.unpacked
    const asarUnpackedPath = `${app.getAppPath()}.unpacked`;

    // Vérifier si le fichier 7za.exe existe dans app.asar.unpacked/node_modules/7zip-bin/win/x64/
    const asarPath = path.join(
      asarUnpackedPath,
      "node_modules",
      "7zip-bin",
      "win",
      "x64"
    );
    const asarFile = path.join(asarPath, "7za.exe");

    let sevenZipPath;

    // Vérifier si le fichier 7za.exe existe dans app.asar.unpacked/node_modules/7zip-bin/win/x64/
    if (fs.existsSync(asarFile)) {
      sevenZipPath = asarFile;
    } else {
      // Utiliser le chemin par défaut
      sevenZipPath = sevenBin.path7za;
    }

    statusUpdate(
      `7zPATH: ${sevenZipPath}\nartifactFilePath: ${artifactFilePath}\nExtractPath: ${extractPath}`
    );

    // Use 7zip-bin to extract the artifact
    const extractionCommand = `"${sevenZipPath}" x "${artifactFilePath}" -o"${extractPath}"`;

    try {
      statusUpdate("Extracting...");
      childProcess.execSync(extractionCommand);
      statusUpdate("Extraction completed.");
    } catch (extractionError) {
      console.error(`Extraction Error: ${extractionError}`);
      statusUpdate(`Extraction Error: ${extractionError.message}`);
    } finally {
      fs.unlinkSync(artifactFilePath);
    }

    // Create a server.cfg file
    statusUpdate("Creating server.cfg...");
    await createServerCfgFile(serverDirectoryName, statusUpdate);

    // Clone cfx-server-data files from GitHub
    statusUpdate("Cloning cfx-server-data from GitHub...");
    await cloneGitHubRepo(serverDirectoryName, statusUpdate);

    if (isLocalModeEnabled) {
      removeSvadhesiveKey();
    }

    statusUpdate("Process completed successfully.");
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

async function removeSvadhesiveKey() {
  const fivemServerPath = path.join(process.cwd(), serverDirectoryName);
  const componentFilePath = path.join(fivemServerPath, "components.json");

  try {
    // Read the JSON file content synchronously
    const componentData = require(componentFilePath);

    // Search for the index of the "svadhesive" key in the array
    const svadhesiveIndex = componentData.indexOf("svadhesive");

    if (svadhesiveIndex !== -1) {
      // Remove the "svadhesive" key using splice
      componentData.splice(svadhesiveIndex, 1);

      // Write the updated JSON array to the component.json file synchronously
      fs.writeFileSync(
        componentFilePath,
        JSON.stringify(componentData, null, 2)
      );

      console.log("The 'svadhesive' keyword has been successfully removed.");
    } else {
      console.log(
        "The 'svadhesive' keyword does not exist in the components.json file."
      );
    }
  } catch (error) {
    console.error(
      "An error occurred while manipulating the components.json file:",
      error
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

    const updatedServerCfgContent = serverCfgContent.replace(
      /change_licensekey/g,
      licenseKey
    );

    // Set the path for the local server.cfg file
    const serverCfgFilePath = path.join(
      process.cwd(),
      serverDirectoryName,
      "server.cfg"
    );

    // Write the content of the local server.cfg file using the template content
    fs.writeFileSync(serverCfgFilePath, updatedServerCfgContent);

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
    const lastLink = links.eq(artifact_version);
    const href = lastLink.attr("href");

    console.log("Last update found:", href);

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
