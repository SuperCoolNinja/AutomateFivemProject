const { app } = require("electron");
const fetch = require("node-fetch");
const sevenBin = require("7zip-bin");
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { globalConfig } = require("../main/app-config");
const {
  removeSvadhesiveKey,
  createServerCfgFile,
} = require("./file-operations");
const childProcess = require("child_process");
const { cloneGitHubRepo } = require("./git");

async function downloadAndExtractArtifact(
  versionArtifactURL,
  statusUpdate = null
) {
  try {
    // Download the artifact
    const artifactResponse = await fetch(versionArtifactURL);

    statusUpdate("Fetch done");

    if (!artifactResponse.ok) {
      statusUpdate(`HTTP error! Status: ${artifactResponse.status}`);
      throw new Error(`HTTP error! Status: ${artifactResponse.status}`);
    }

    const artifactBuffer = await artifactResponse.buffer();

    statusUpdate("Downloading...");

    // Save the artifact to the FivemServer directory
    const artifactFileName = path.basename(versionArtifactURL);
    const fivemServerPath = path.join(
      process.cwd(),
      globalConfig.serverDirectoryName
    );

    const artifactFilePath = path.join(fivemServerPath, artifactFileName);
    fs.writeFileSync(artifactFilePath, artifactBuffer);

    // Set the extraction path
    const extractPath = path.join(
      process.cwd(),
      globalConfig.serverDirectoryName
    );

    const asarUnpackedPath = `${app.getAppPath()}.unpacked`;

    const asarPath = path.join(
      asarUnpackedPath,
      "node_modules",
      "7zip-bin",
      "win",
      "x64"
    );
    const asarFile = path.join(asarPath, "7za.exe");

    let sevenZipPath;

    if (fs.existsSync(asarFile)) {
      sevenZipPath = asarFile;
    } else {
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
    await createServerCfgFile(statusUpdate);

    // Clone cfx-server-data files from GitHub
    statusUpdate("Cloning cfx-server-data from GitHub...");
    await cloneGitHubRepo(statusUpdate);

    if (globalConfig.isLocalModeEnabled) {
      removeSvadhesiveKey();
    }

    statusUpdate("Process completed successfully.");
  } catch (error) {
    statusUpdate(`An error occurred: ${error.message}`);
  }
}

async function downloadFiveMArtifacts(statusUpdate) {
  try {
    const fetchOptions = {
      timeout: 5000, // Set a timeout limit for the fetch request
    };

    const response = await fetch(globalConfig.artifactsURL, fetchOptions);

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
    const lastLink = links.eq(globalConfig.artifact_version);
    const href = lastLink.attr("href");

    console.log("Last update found:", href);

    // Check if the server directory already exists
    if (fs.existsSync(globalConfig.serverDirectoryName)) {
      statusUpdate(`Project directory already exists.`);
      return;
    }

    fs.mkdirSync(path.join(process.cwd(), globalConfig.serverDirectoryName), {
      recursive: true,
    });

    // Call the function to download and extract the artifact
    await downloadAndExtractArtifact(
      `${globalConfig.artifactsURL}${href}`,
      statusUpdate
    );
  } catch (error) {
    statusUpdate(`An error occurred downloading: ${error}`);
    console.error(`An error occurred downloading: ${error}`);
  }
}

module.exports = {
  downloadAndExtractArtifact,
  downloadFiveMArtifacts,
};
