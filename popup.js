const STORAGE_KEY = "temuLocalFilterEnabled";
const HIGHLIGHT_STORAGE_KEY = "temuLocalHighlightEnabled";
const MENU_STORAGE_KEY = "temuFloatingMenuEnabled";

const filterToggle = document.getElementById("filterToggle");
const highlightToggle = document.getElementById("highlightToggle");
const menuToggle = document.getElementById("menuToggle");

const render = (state) => {
  filterToggle.checked = state[STORAGE_KEY] !== false;
  highlightToggle.checked = state[HIGHLIGHT_STORAGE_KEY] === true;
  menuToggle.checked = state[MENU_STORAGE_KEY] !== false;
};

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(
    {
      [STORAGE_KEY]: true,
      [HIGHLIGHT_STORAGE_KEY]: false,
      [MENU_STORAGE_KEY]: true
    },
    (result) => {
      render(result);
    }
  );

  filterToggle.addEventListener("change", () => {
    chrome.storage.local.set({ [STORAGE_KEY]: filterToggle.checked });
  });

  highlightToggle.addEventListener("change", () => {
    chrome.storage.local.set({ [HIGHLIGHT_STORAGE_KEY]: highlightToggle.checked });
  });

  menuToggle.addEventListener("change", () => {
    chrome.storage.local.set({ [MENU_STORAGE_KEY]: menuToggle.checked });
  });
});
