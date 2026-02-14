(() => {
  const STORAGE_KEY = "temuLocalFilterEnabled";
  const HIGHLIGHT_STORAGE_KEY = "temuLocalHighlightEnabled";
  const MENU_STORAGE_KEY = "temuFloatingMenuEnabled";
  const HIDE_CLASS = "temu-local-hidden";
  const HIGHLIGHT_CLASS = "temu-local-highlight";
  const REMOVING_CLASS = "temu-local-removing";
  const RESTORING_CLASS = "temu-local-restoring";
  const RESTORE_ANIM_CLASS = "temu-local-restore-anim";
  const TOGGLE_ID = "temu-local-toggle";
  const HIGHLIGHT_TOGGLE_ID = "temu-local-highlight-toggle";
  const MENU_ID = "temu-local-menu";

  const removed = new Map();
  let enabled = true;
  let highlightEnabled = false;
  let autoDisabled = false;
  let cooldownUntil = 0;
  let removedCount = 0;
  let hiddenCount = 0;
  let scheduled = false;
  let renderScheduled = false;
  const pendingRoots = new Set();
  let filterToggleInput = null;
  let highlightToggleInput = null;
  let filterStatusEl = null;
  let filterWarningEl = null;
  let highlightStatusEl = null;
  let menuEl = null;
  let isDraggingMenu = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let menuEnabled = true;

  const scheduleScan = (root = document) => {
    if (cooldownUntil && Date.now() < cooldownUntil) return;
    pendingRoots.add(root);
    if (scheduled) return;
    scheduled = true;

    const run = () => {
      scheduled = false;
      if (!enabled && !highlightEnabled) {
        pendingRoots.clear();
        return;
      }

      const roots = Array.from(pendingRoots);
      pendingRoots.clear();
      for (const r of roots) {
        scanAll(r, false);
      }
    };

    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 500 });
    } else {
      setTimeout(run, 100);
    }
  };

  const normalizeRoot = (root) => {
    if (!root) return null;
    if (root.nodeType === 9) return root.documentElement; // Document
    if (root.nodeType === 11) return root.firstElementChild; // DocumentFragment
    if (root.nodeType === 1) return root; // Element
    return null;
  };

  const isExtensionContextValid = () =>
    !!(chrome && chrome.runtime && chrome.runtime.id);

  const isLocalText = (node) => {
    if (!node || node.nodeType !== 1) return false;
    if (node.tagName !== "SPAN") return false;
    const text = node.textContent ? node.textContent.trim() : "";
    return text === "Yerel";
  };


  const scheduleRender = () => {
    if (renderScheduled) return;
    renderScheduled = true;
    const run = () => {
      renderScheduled = false;
      updateToggleUI();
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 300 });
    } else {
      setTimeout(run, 0);
    }
  };

  const scheduleHighlightRender = () => {
    if (renderScheduled) return;
    renderScheduled = true;
    const run = () => {
      renderScheduled = false;
      updateHighlightToggleUI();
      updateToggleUI();
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 300 });
    } else {
      setTimeout(run, 0);
    }
  };

  const autoDisable = () => {
    if (autoDisabled) return;
    autoDisabled = true;
    enabled = false;
    cooldownUntil = Date.now() + 30000;
    restoreAll();
    scheduleRender();
  };

  const restoreAll = () => {
    for (const [ph, card] of removed) {
      if (ph.isConnected) {
        ph.replaceWith(card);
        card.classList.remove(REMOVING_CLASS);
        card.classList.add(RESTORE_ANIM_CLASS);
        card.classList.add(RESTORING_CLASS);
        void card.offsetHeight;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            card.classList.remove(RESTORING_CLASS);
            setTimeout(() => {
              card.classList.remove(RESTORE_ANIM_CLASS);
            }, 960);
          });
        });
        delete card.dataset.temuLocalRemoved;
        delete card.dataset.temuLocalHidden;
        delete card.dataset.temuLocalProcessed;
        delete card.dataset.temuLocalChecked;
      }
    }
    removed.clear();
    removedCount = 0;
    hiddenCount = 0;
    scheduleRender();
  };

  const highlightCard = (card) => {
    if (!card) return;
    if (card.dataset.temuLocalHighlighted === "1") return;
    card.dataset.temuLocalHighlighted = "1";
    card.classList.add(HIGHLIGHT_CLASS);
  };

  const clearHighlights = () => {
    const nodes = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    for (const card of nodes) {
      card.classList.remove(HIGHLIGHT_CLASS);
      delete card.dataset.temuLocalHighlighted;
    }
  };

  const hideCard = (card) => {
    if (!card) return;
    if (highlightEnabled) {
      highlightCard(card);
      return;
    }
    if (!enabled) return;
    if (card.dataset.temuLocalRemoved === "1") return;
    if (card.dataset.temuLocalHidden === "1") return;
    card.dataset.temuLocalRemoved = "1";
    card.dataset.temuLocalHidden = "1";
    removedCount += 1;
    hiddenCount += 1;
    card.classList.add(REMOVING_CLASS);
    const placeholder = document.createComment("temu-local-placeholder");
    setTimeout(() => {
      if (!card.isConnected) return;
      if (!enabled || highlightEnabled) {
        card.classList.remove(REMOVING_CLASS);
        delete card.dataset.temuLocalRemoved;
        delete card.dataset.temuLocalHidden;
        return;
      }
      card.replaceWith(placeholder);
      removed.set(placeholder, card);
      scheduleRender();
    }, 960);
  };

  const hideCardForSpan = (span) => {
    const inner = span.closest('div[role="group"]');
    const card = inner?.parentElement?.parentElement || inner;
    if (!card) return;
    card.dataset.temuLocalProcessed = "1";
    hideCard(card);
  };

  const handlePotentialSpan = (node) => {
    if (!node || node.nodeType !== 1) return;

    if (node.matches("span.C9HMW0KN")) {
      hideCardForSpan(node);
      return;
    }

    if (isLocalText(node)) {
      const inner = node.closest('div[role="group"]');
      const card = inner?.parentElement?.parentElement || inner;
      if (card) hideCardForSpan(node);
    }
  };

  const scanAll = (root, force) => {
    const r = normalizeRoot(root);
    if (!r) return;
    if (cooldownUntil && Date.now() < cooldownUntil) return;

    const groupsForCount = r.querySelectorAll('div[role="group"]');
    const total = groupsForCount.length;
    let localCount = 0;
    if (total >= 12) {
      for (const group of groupsForCount) {
        if (group.querySelector("span.C9HMW0KN")) {
          localCount += 1;
          continue;
        }
        const spans = group.querySelectorAll("span");
        for (const span of spans) {
          if (isLocalText(span)) {
            localCount += 1;
            break;
          }
        }
      }
    }

    // Handle root if it is a span itself.
    handlePotentialSpan(r);

    // Fast path: known class.
    const classSpans = r.querySelectorAll("span.C9HMW0KN");
    for (const span of classSpans) {
      hideCardForSpan(span);
    }

    // Fallback: only within role="group" cards.
    const groups = r.querySelectorAll('div[role="group"]');
    for (const group of groups) {
      if (!force && group.dataset.temuLocalChecked === "1") continue;

      let found = false;
      const spans = group.querySelectorAll("span");
      for (const span of spans) {
        if (isLocalText(span)) {
          hideCardForSpan(span);
          found = true;
          break;
        }
      }

      group.dataset.temuLocalChecked = "1";

      if (found) {
        group.dataset.temuLocalProcessed = "1";
      }
    }

    if (enabled && !highlightEnabled && total >= 12 && localCount / total >= 0.9) {
      autoDisable();
    }
  };

  const setEnabled = (value) => {
    enabled = value;
    autoDisabled = false;
    if (enabled) cooldownUntil = 0;
    updateToggleUI();

    if (!enabled) {
      restoreAll();
      return;
    }

    // Re-scan everything when re-enabled.
    scheduleScan(document);
    scanAll(document, true);
  };

  const setHighlightEnabled = (value, persist = true) => {
    highlightEnabled = value;
    if (persist && isExtensionContextValid()) {
      try {
        chrome.storage.local.set({ [HIGHLIGHT_STORAGE_KEY]: highlightEnabled });
      } catch (_) {
        // ignore storage failures
      }
    }
    if (highlightEnabled) {
      restoreAll();
      scheduleScan(document);
      scanAll(document, true);
    } else {
      clearHighlights();
      if (enabled) {
        scheduleScan(document);
        scanAll(document, true);
      }
    }
    updateHighlightToggleUI();
    updateToggleUI();
    scheduleHighlightRender();
  };

  const createToggle = () => {
    if (document.getElementById(MENU_ID)) return;

    const menu = document.createElement("div");
    menu.id = MENU_ID;
    menu.className = "temu-local-menu";
    menuEl = menu;

    const rowFilter = document.createElement("div");
    rowFilter.className = "temu-local-menu-row";
    const filterLabel = document.createElement("div");
    filterLabel.className = "temu-local-menu-label";
    filterLabel.textContent = "Yerel Filtre";
    filterStatusEl = document.createElement("div");
    filterStatusEl.className = "temu-local-menu-status";
    filterWarningEl = document.createElement("div");
    filterWarningEl.className = "temu-local-menu-warning";

    const filterSwitch = document.createElement("label");
    filterSwitch.className = "temu-local-menu-switch";
    filterToggleInput = document.createElement("input");
    filterToggleInput.type = "checkbox";
    const filterSlider = document.createElement("span");
    filterSlider.className = "temu-local-menu-slider";
    filterSwitch.appendChild(filterToggleInput);
    filterSwitch.appendChild(filterSlider);

    rowFilter.appendChild(filterLabel);
    rowFilter.appendChild(filterSwitch);
    rowFilter.appendChild(filterStatusEl);
    rowFilter.appendChild(filterWarningEl);

    const rowHighlight = document.createElement("div");
    rowHighlight.className = "temu-local-menu-row";
    const highlightLabel = document.createElement("div");
    highlightLabel.className = "temu-local-menu-label";
    highlightLabel.textContent = "Yerel Vurgulama";
    highlightStatusEl = document.createElement("div");
    highlightStatusEl.className = "temu-local-menu-status";

    const highlightSwitch = document.createElement("label");
    highlightSwitch.className = "temu-local-menu-switch";
    highlightToggleInput = document.createElement("input");
    highlightToggleInput.type = "checkbox";
    const highlightSlider = document.createElement("span");
    highlightSlider.className = "temu-local-menu-slider";
    highlightSwitch.appendChild(highlightToggleInput);
    highlightSwitch.appendChild(highlightSlider);

    rowHighlight.appendChild(highlightLabel);
    rowHighlight.appendChild(highlightSwitch);
    rowHighlight.appendChild(highlightStatusEl);

    menu.appendChild(rowFilter);
    menu.appendChild(rowHighlight);


    filterToggleInput.addEventListener("change", () => {
      const next = !!filterToggleInput.checked;
      if (!isExtensionContextValid()) {
        setEnabled(next);
        return;
      }
      try {
        chrome.storage.local.set({ [STORAGE_KEY]: next }, () => {
          setEnabled(next);
        });
      } catch (_) {
        // Extension context may be invalidated during navigation.
      }
    });

    highlightToggleInput.addEventListener("change", () => {
      setHighlightEnabled(!!highlightToggleInput.checked, true);
    });
    document.documentElement.appendChild(menu);
    updateToggleUI();
    updateHighlightToggleUI();
    updateMenuVisibility();
  };

  const createHighlightToggle = () => {
    // no-op: merged into single menu
  };

  const updateToggleUI = () => {
    if (!filterToggleInput || !filterStatusEl || !filterWarningEl) return;
    filterToggleInput.checked = !!enabled;
    filterStatusEl.textContent = enabled
      ? `AÇIK • Gizlenen: ${hiddenCount}`
      : `KAPALI • Gizlenen: ${hiddenCount}`;
    filterWarningEl.textContent = "";
    if (autoDisabled) {
      filterStatusEl.textContent = `KAPALI (otomatik) • Gizlenen: ${hiddenCount}`;
      filterWarningEl.textContent =
        "Bu sayfada ürünlerin çoğu Yerel. Filtre otomatik kapatıldı.";
    }
    filterStatusEl.title = `Gizlenen: ${hiddenCount}`;
  };

  const updateHighlightToggleUI = () => {
    if (!highlightToggleInput || !highlightStatusEl) return;
    highlightToggleInput.checked = !!highlightEnabled;
    highlightStatusEl.textContent = highlightEnabled ? "AÇIK" : "KAPALI";
  };

  const updateMenuVisibility = () => {
    if (!menuEl) return;
    menuEl.style.display = menuEnabled ? "grid" : "none";
  };

  const observe = () => {
    const observer = new MutationObserver((mutations) => {
      if (cooldownUntil && Date.now() < cooldownUntil) return;
      if (!enabled && !highlightEnabled) return;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!node || node.nodeType !== 1) continue;
          // If a span is added directly, handle it.
          handlePotentialSpan(node);
          // Otherwise schedule a scan for its subtree.
          scheduleScan(node);
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  };

  const initMenuDrag = () => {
    if (!menuEl) return;

    const onPointerDown = (e) => {
      const target = e.target;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "LABEL" ||
          target.classList.contains("temu-local-menu-slider"))
      ) {
        return;
      }
      isDraggingMenu = true;
      const rect = menuEl.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      menuEl.style.right = "auto";
      menuEl.style.bottom = "auto";
      menuEl.style.left = `${rect.left}px`;
      menuEl.style.top = `${rect.top}px`;
      menuEl.classList.add("temu-local-menu-dragging");
      e.preventDefault();
    };

    const onPointerMove = (e) => {
      if (!isDraggingMenu || !menuEl) return;
      const x = e.clientX - dragOffsetX;
      const y = e.clientY - dragOffsetY;
      menuEl.style.left = `${x}px`;
      menuEl.style.top = `${y}px`;
    };

    const onPointerUp = () => {
      if (!isDraggingMenu) return;
      isDraggingMenu = false;
      menuEl.classList.remove("temu-local-menu-dragging");
    };

    menuEl.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  };

  const init = () => {
    if (!isExtensionContextValid()) return;
    try {
      chrome.storage.local.get(
        {
          [STORAGE_KEY]: true,
          [HIGHLIGHT_STORAGE_KEY]: false,
          [MENU_STORAGE_KEY]: true
        },
        (result) => {
        enabled = result[STORAGE_KEY] !== false;
        highlightEnabled = result[HIGHLIGHT_STORAGE_KEY] === true;
        menuEnabled = result[MENU_STORAGE_KEY] !== false;
        createToggle();
        createHighlightToggle();
        setEnabled(enabled);
        if (highlightEnabled) {
          setHighlightEnabled(true, false);
        }
        initMenuDrag();
        updateMenuVisibility();
        observe();
        scheduleScan(document);
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (changes[STORAGE_KEY]) {
          const next = changes[STORAGE_KEY].newValue !== false;
          if (next !== enabled) {
            setEnabled(next);
          }
        }
        if (changes[HIGHLIGHT_STORAGE_KEY]) {
          const next = changes[HIGHLIGHT_STORAGE_KEY].newValue === true;
          if (next !== highlightEnabled) {
            setHighlightEnabled(next, false);
          }
        }
        if (changes[MENU_STORAGE_KEY]) {
          const next = changes[MENU_STORAGE_KEY].newValue !== false;
          if (next !== menuEnabled) {
            menuEnabled = next;
            updateMenuVisibility();
          }
        }
      });
    } catch (_) {
      // Extension context may be invalidated during navigation.
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
