const STORAGE_KEY = "color-scheme";
const GITHUB_ORG_REPOS_URL = "https://api.github.com/orgs/BlackbirdWorks/repos?per_page=100&type=public";
const STATS_CACHE_KEY = "bbw_repo_stats_v1";
const STATS_TTL_MS = 15 * 60 * 1000;

function getMetaScheme() {
  return document.querySelector('meta[name="color-scheme"]');
}

function getStoredScheme() {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === "light" || val === "dark" ? val : null;
  } catch {
    return null;
  }
}

function setStoredScheme(value) {
  try {
    if (value === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, value);
    }
  } catch {
    // Ignore storage failures when site data is blocked; the active session still updates.
  }
}

function applyScheme(value) {
  const meta = getMetaScheme();
  if (!meta) return;
  meta.content = value === "light" || value === "dark" ? value : "light dark";
}

function initThemeToggle() {
  const toggleBtn = document.getElementById("theme-toggle");
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  // Track active override in memory in case localStorage is disabled
  let memoryOverride = getStoredScheme();
  applyScheme(memoryOverride);

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const systemScheme = darkQuery.matches ? "dark" : "light";
      const currentStored = getStoredScheme() ?? memoryOverride;
      const renderedScheme = currentStored ?? systemScheme;
      const targetScheme = renderedScheme === "dark" ? "light" : "dark";

      if (targetScheme === systemScheme) {
        memoryOverride = null;
        setStoredScheme(null);
        applyScheme(null);
      } else {
        memoryOverride = targetScheme;
        setStoredScheme(targetScheme);
        applyScheme(targetScheme);
      }
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    const next = event.newValue === "light" || event.newValue === "dark" ? event.newValue : null;
    memoryOverride = next;
    applyScheme(next);
  });
}

function initRepoFilters() {
  const filterButtons = Array.from(document.querySelectorAll(".filter-btn"));
  const searchInput = document.getElementById("repo-search");
  const cards = Array.from(document.querySelectorAll(".repo-card"));
  const statusEl = document.getElementById("repo-status");
  const emptyEl = document.getElementById("repo-empty");
  const resetBtn = document.getElementById("reset-filters");

  if (!cards.length) return;

  let activeFilter = "all";
  let searchTerm = "";

  function matchesFilter(card, filter) {
    switch (filter) {
      case "original":
        return card.dataset.origin === "original";
      case "go":
        return card.dataset.lang === "go";
      case "pages":
        return card.dataset.hasPages === "true";
      case "fork":
        return card.dataset.origin === "fork";
      default:
        return true;
    }
  }

  function applyFilters() {
    const query = searchTerm.trim().toLowerCase();
    let visibleCount = 0;

    for (const card of cards) {
      const haystack = (card.dataset.search || "") + " " + (card.textContent || "").toLowerCase();
      const visible = matchesFilter(card, activeFilter) && (!query || haystack.includes(query));
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    }

    if (statusEl) {
      statusEl.textContent = `Showing ${visibleCount} of ${cards.length} repositories`;
    }

    if (emptyEl) {
      emptyEl.hidden = visibleCount > 0;
    }
  }

  for (const btn of filterButtons) {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter || "all";
      for (const other of filterButtons) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
      applyFilters();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchTerm = searchInput.value;
      applyFilters();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      activeFilter = "all";
      searchTerm = "";
      if (searchInput) searchInput.value = "";
      for (const btn of filterButtons) {
        btn.setAttribute("aria-pressed", String(btn.dataset.filter === "all"));
      }
      applyFilters();
      if (searchInput) searchInput.focus();
    });
  }
}

function initCopyButtons() {
  const buttons = Array.from(document.querySelectorAll(".copy-btn"));
  const announcer = document.getElementById("copy-status");

  for (const btn of buttons) {
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy;
      if (!text || !navigator.clipboard) return;

      const labelTextNode = btn.firstChild;
      const originalLabel = labelTextNode ? labelTextNode.textContent : "Copy ";

      try {
        await navigator.clipboard.writeText(text);
        if (labelTextNode) labelTextNode.textContent = "Copied ";
        if (announcer) announcer.textContent = "Copied command to clipboard.";
        window.setTimeout(() => {
          if (labelTextNode) labelTextNode.textContent = originalLabel;
        }, 1800);
      } catch {
        if (announcer) announcer.textContent = "Unable to copy command to clipboard.";
      }
    });
  }
}

function updateStarCounts(repos) {
  if (!Array.isArray(repos)) return;
  const starMap = new Map();
  for (const repo of repos) {
    if (repo && typeof repo.name === "string" && typeof repo.stargazers_count === "number") {
      starMap.set(repo.name, repo.stargazers_count);
    }
  }

  const targets = document.querySelectorAll("[data-repo-stars]");
  for (const el of targets) {
    const name = el.getAttribute("data-repo-stars");
    if (name && starMap.has(name)) {
      el.textContent = String(starMap.get(name));
    }
  }
}

async function hydrateLiveRepoStats() {
  try {
    const cachedRaw = sessionStorage.getItem(STATS_CACHE_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached && typeof cached.ts === "number" && Date.now() - cached.ts < STATS_TTL_MS) {
        updateStarCounts(cached.repos);
        return;
      }
    }
  } catch {
    // Proceed without cache if sessionStorage is unavailable.
  }

  try {
    const response = await fetch(GITHUB_ORG_REPOS_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return;
    const repos = await response.json();
    updateStarCounts(repos);

    try {
      const compact = Array.isArray(repos)
        ? repos.map((r) => ({ name: r.name, stargazers_count: r.stargazers_count }))
        : [];
      sessionStorage.setItem(STATS_CACHE_KEY, JSON.stringify({ ts: Date.now(), repos: compact }));
    } catch {
      // Ignore cache write errors.
    }
  } catch {
    // Keep pre-rendered baseline metadata if offline or rate-limited.
  }
}

initThemeToggle();
initRepoFilters();
initCopyButtons();
hydrateLiveRepoStats();
