const { ipcRenderer } = require("electron");

const generateButton = document.getElementById("generateButton");
const statusText = document.getElementById("statusText");

const licenseInput = document.getElementById("license");

const runLocalModeCheckbox = document.getElementById("runLocalModeCheckbox");
const license_container = document.getElementById("license_container");


runLocalModeCheckbox.addEventListener("change", () => {
  license_container.style.display = runLocalModeCheckbox.checked ? "none" : "block";
});

generateButton.addEventListener("click", () => {
  const licenseKey = licenseInput.value;

  if (!runLocalModeCheckbox.checked) {
    if (licenseKey.trim() === "") {
      licenseInput.classList.add("error-box");
      licenseError.style.display = "block";
      return;
    }

    if (!licenseKey.startsWith("cfxk_")) {
      licenseInput.classList.add("error-box");
      licenseError.textContent = "License key must start with 'cfxk_'.";
      licenseError.style.display = "block";
      return;
    }
  } else {
  }

  licenseInput.classList.remove("error-box");
  licenseError.style.display = "none";

  ipcRenderer.send("generate", licenseKey, runLocalModeCheckbox.checked);
  statusText.textContent = "Generating...";
});

ipcRenderer.on("status-update", (event, message) => {
  statusText.textContent = message;
});

const optionsSelector = document.getElementById("optionsSelector");

optionsSelector.addEventListener("change", (event) => {
  const selectedValue = event.target.value;

  ipcRenderer.send("updateLinks", selectedValue);
});
