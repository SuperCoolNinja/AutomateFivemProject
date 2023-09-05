const simpleGit = require("simple-git");
const path = require("path");
const fs = require("fs");
const fse = require("fs-extra");
const { globalConfig } = require("../main/app-config");

async function cloneGitHubRepo(statusUpdate) {
  try {
    const repoUrl = "https://github.com/citizenfx/cfx-server-data.git";
    const fivemServerPath = path.join(
      process.cwd(),
      globalConfig.serverDirectoryName
    );

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

module.exports = {
  cloneGitHubRepo,
};
