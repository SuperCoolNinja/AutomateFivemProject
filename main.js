const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const fse = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");
const sevenBin = require("7zip-bin");
const fetch = require("node-fetch");
const simpleGit = require("simple-git");
const childProcess = require("child_process"); // Importez child_process

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

  // Appel de la fonction pour télécharger et extraire les artefacts
  await downloadFiveMArtifacts(statusUpdate);
});

async function downloadAndExtractArtifact(
  artifactURL,
  serverDirectoryName,
  statusUpdate = null
) {
  try {
    // Téléchargez l'artefact
    const artifactResponse = await fetch(artifactURL);
    const artifactBuffer = await artifactResponse.buffer();

    statusUpdate("Downloading...");

    // Enregistrez l'artefact dans le répertoire du serveur
    const artifactFileName = path.basename(artifactURL);
    const artifactFilePath = path.join(
      __dirname,
      serverDirectoryName,
      artifactFileName
    );
    fs.writeFileSync(artifactFilePath, artifactBuffer);

    statusUpdate("Extracting...");

    // Utilisez 7zip-bin pour extraire l'artefact
    const extractPath = path.join(__dirname, serverDirectoryName);
    const sevenZipPath = sevenBin.path7za;
    const extractionCommand = `"${sevenZipPath}" x "${artifactFilePath}" -o"${extractPath}" -r`;
    childProcess.execSync(extractionCommand);

    // Supprimez le fichier 7z après l'extraction
    fs.unlinkSync(artifactFilePath);

    // Créez un fichier server.cfg
    statusUpdate("Creating server.cfg...");
    await createServerCfgFile(serverDirectoryName, statusUpdate);

    // Clonez les fichiers cfx-server-data depuis GitHub
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

    // Clonez le référentiel GitHub dans un répertoire temporaire
    const tempPath = path.join(__dirname);
    const git = simpleGit(tempPath);
    await git.clone(repoUrl);

    statusUpdate("GitHub repository cloned successfully.");

    // Déplacez le contenu du dossier enfant (par exemple, "cfx-server-data") dans FivemServer
    const childRepoPath = path.join(tempPath, "cfx-server-data");
    const childRepoContents = await fs.promises.readdir(childRepoPath);
    for (const item of childRepoContents) {
      const srcPath = path.join(childRepoPath, item);
      const destPath = path.join(fivemServerPath, item);
      await fse.move(srcPath, destPath, { overwrite: true });
    }

    // Supprimez le répertoire temporaire
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
    // Lisez le contenu de la template server.cfg.template
    const serverCfgTemplatePath = path.join(__dirname, "server.cfg.template");
    const serverCfgContent = fs.readFileSync(serverCfgTemplatePath, "utf-8");

    // Définissez le chemin du fichier server.cfg local
    const serverCfgFilePath = path.join(
      __dirname,
      serverDirectoryName,
      "server.cfg"
    );

    // Écrivez le contenu du fichier server.cfg local en utilisant le contenu de la template
    fs.writeFileSync(serverCfgFilePath, serverCfgContent);

    statusUpdate("server.cfg created successfully.");
  } catch (error) {
    statusUpdate(`An error occurred: ${error.message}`);
  }
}

async function downloadFiveMArtifacts(statusUpdate) {
  try {
    const fetchOptions = {
      timeout: 5000, // Définissez une limite de temps pour la requête fetch
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
    const lastLink = links.eq(3); // Utilisez last() pour obtenir le lien le plus récent
    const href = lastLink.attr("href");

    console.log("Last update found:", href);

    const serverDirectoryName = "FivemServer";

    // Vérifiez si le répertoire du serveur existe déjà
    if (fs.existsSync(serverDirectoryName)) {
      statusUpdate(`Project directory already exists.`);
      return;
    }

    fs.mkdirSync(serverDirectoryName);

    // Appelez la fonction pour télécharger et extraire l'artefact
    await downloadAndExtractArtifact(
      `${artifactURL}${href}`, // Combinez l'URL de base avec href
      serverDirectoryName,
      statusUpdate
    );
  } catch (error) {
    statusUpdate(`An error occurred: ${error}`);
    console.error(`An error occurred: ${error}`);
  }
}
