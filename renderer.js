const { ipcRenderer } = require("electron");

const generateButton = document.getElementById("generateButton");
const statusText = document.getElementById("statusText");

// Sélectionnez l'élément input par son ID
const licenseInput = document.getElementById("license");

generateButton.addEventListener("click", () => {
  const licenseKey = licenseInput.value;
  
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

  licenseInput.classList.remove("error-box");
  licenseError.style.display = "none";

  ipcRenderer.send("generate", licenseKey);
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
