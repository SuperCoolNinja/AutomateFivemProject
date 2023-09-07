const fs = require("fs");
const path = require("path");
const { globalConfig } = require("../main/app-config");

async function removeSvadhesiveKey() {
  const fivemServerPath = path.join(
    process.cwd(),
    globalConfig.serverDirectoryName
  );
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

async function createServerCfgFile(statusUpdate) {
  try {
    // Read the content of the server.cfg.template
    const serverCfgTemplatePath = path.join(
      process.cwd(),
      "assets/server.cfg.template"
    );
    const serverCfgContent = fs.readFileSync(serverCfgTemplatePath, "utf-8");

    // Replace placeholders with actual values
    const updatedServerCfgContent = serverCfgContent
      .replace(/change_licensekey/g, globalConfig.licenseKey)
      .replace(/change_hostname/g, globalConfig.title)
      .replace(/change_project_name/g, globalConfig.project_name)
      .replace(/change_project_description/g, globalConfig.project_description);

    // Set the path for the local server.cfg file
    const serverCfgFilePath = path.join(
      process.cwd(),
      globalConfig.serverDirectoryName,
      "server.cfg"
    );

    // Write the content of the local server.cfg file using the template content
    fs.writeFileSync(serverCfgFilePath, updatedServerCfgContent);

    statusUpdate("server.cfg created successfully.");
  } catch (error) {
    statusUpdate(`An error occurred: ${error.message}`);
  }
}

// Generation of the launcher named : run.bat
async function createLauncherBatFile(fivemServerPath) {
  const runBatFilePath = path.join(fivemServerPath, "run.bat");
  let runBatContent = "FXServer.exe +exec server.cfg";

  if (globalConfig.launcherOptions.trim() !== "") {
    runBatContent += " " + globalConfig.launcherOptions;
  }

  fs.writeFileSync(runBatFilePath, runBatContent);
}

module.exports = {
  createServerCfgFile,
  createLauncherBatFile,
  removeSvadhesiveKey,
};
