(() => {
  const API_ROOT = "https://retroachievements.org/API/";
  const MEDIA_ROOT = "https://media.retroachievements.org/";
  const SITE_ROOT = "https://retroachievements.org/";
  const LOCAL_CACHE = {
    consoles: "assets/cache/consoles.json",
    badges: "assets/cache/achievement-badges.json",
    achievements: "assets/cache/achievements.json",
    completion: "assets/cache/completion.json"
  };

  const defaultConfig = window.RA_CONFIG || {};
  const params = new URLSearchParams(window.location.search);
  const config = {
    username: params.get("user") || defaultConfig.username || "",
    apiKey: params.get("key") || defaultConfig.apiKey || ""
  };

  const elements = {
    points: document.getElementById("stat-points"),
    truePoints: document.getElementById("stat-truepoints"),
    rank: document.getElementById("stat-rank"),
    achHardcore: document.getElementById("stat-ach-hardcore"),
    achSoftcore: document.getElementById("stat-ach-softcore"),
    profileAvatar: document.getElementById("profile-avatar"),
    profileName: document.getElementById("profile-name"),
    profileMotto: document.getElementById("profile-motto"),
    presenceMsg: document.getElementById("presence-message"),
    presenceGame: document.getElementById("presence-game"),
    presenceIcon: document.getElementById("presence-icon"),
    presenceConsoleName: document.getElementById("presence-console-name"),
    presenceConsoleIcon: document.getElementById("presence-console-icon"),
    presenceAchCount: document.getElementById("presence-ach-count"),
    achievementsGrid: document.getElementById("achievements-grid"),
    masteredGrid: document.getElementById("mastered-grid"),
    completedGrid: document.getElementById("completed-grid"),
    statusAchievements: document.getElementById("status-achievements"),
    statusCompletion: document.getElementById("status-completion"),
    lastUpdated: document.getElementById("last-updated"),
    tickerTrack: document.getElementById("ticker-track"),
    consoleChart: document.getElementById("console-chart")
  };

  function setStatus(el, text) {
    if (el) el.textContent = text;
  }

  function formatNumber(value) {
    if (value === undefined || value === null || value === "") return "--";
    return Number(value).toLocaleString();
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
  }

  function parseAchievementDate(achievement) {
    const raw =
      achievement.Date ||
      achievement.date ||
      achievement.DateEarned ||
      achievement.UnlockedAt ||
      achievement.unlockedAt;
    if (!raw) return 0;
    if (typeof raw === "number") return raw * 1000;
    if (typeof raw !== "string") return 0;
    const isoLike = raw.includes("T") ? raw : raw.replace(" ", "T");
    const parsed = Date.parse(isoLike);
    if (!Number.isNaN(parsed)) return parsed;
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      const [, y, m, d, hh, mm, ss] = match.map(Number);
      return Date.UTC(y, m - 1, d, hh, mm, ss);
    }
    return 0;
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
  }

  function toMedia(path) {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return MEDIA_ROOT + path.replace(/^\/+/, "");
  }

  function badgeUrl(badgeName) {
    if (!badgeName) return "";
    return `${MEDIA_ROOT}Badge/${badgeName}.png`;
  }

  function userPicUrl(path) {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return SITE_ROOT + path.replace(/^\/+/, "");
  }

  function consoleIconUrl(consoleId, consoleMap) {
    if (!consoleId) return "";
    if (consoleMap && consoleMap.has(consoleId)) {
      return consoleMap.get(consoleId);
    }
    return `assets/console-icons/${consoleId}.png`;
  }

  function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return Object.values(value);
  }

  function serializeParams(params) {
    const entries = Object.entries(params || {}).sort(([a], [b]) => a.localeCompare(b));
    return entries.map(([key, value]) => `${key}=${value}`).join("&");
  }

  function getCache(key, ttlMs) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!payload || !payload.ts) return null;
      if (Date.now() - payload.ts > ttlMs) return null;
      return payload.data;
    } catch (error) {
      return null;
    }
  }

  function setCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch (error) {
      // Ignore cache write failures (quota, privacy mode).
    }
  }

  async function cachedCall(endpoint, params, ttlMs) {
    const key = `ra-cache:${endpoint}:${serializeParams(params)}`;
    const cached = getCache(key, ttlMs);
    if (cached) return cached;
    const data = await apiCall(endpoint, params);
    setCache(key, data);
    return data;
  }

  async function fetchRecentAchievements() {
    const now = Math.floor(Date.now() / 1000);
    const ranges = [3, 7, 30, 90, 365, 3650];
    let fallback = [];
    for (const days of ranges) {
      const from = now - days * 86400;
      const data = await cachedCall("API_GetAchievementsEarnedBetween.php", { f: from, t: now }, 5 * 60 * 1000);
      const items = ensureArray(data);
      if (items.length >= 8) return items;
      if (items.length > fallback.length) fallback = items;
    }
    return fallback;
  }

  async function fetchAchievementLibrary(memberSince) {
    const now = Math.floor(Date.now() / 1000);
    const fromDate = memberSince ? Math.floor(new Date(memberSince).getTime() / 1000) : now - 3650 * 86400;
    const data = await cachedCall("API_GetAchievementsEarnedBetween.php", { f: fromDate, t: now }, 12 * 60 * 60 * 1000);
    return ensureArray(data);
  }

  async function fetchLocalJson(path) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  function shuffleArray(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function renderTicker(items, badgeSet) {
    if (!elements.tickerTrack) return;
    const list = ensureArray(items);
    if (!list.length) {
      elements.tickerTrack.innerHTML = "";
      return;
    }

    const selected = shuffleArray(list).slice(0, 20);
    const doubled = [...selected, ...selected];
    elements.tickerTrack.innerHTML = doubled
      .map((achievement) => {
        const badge =
          achievement.BadgeName || achievement.badgeName || achievement.Badge || achievement.BadgeNameSmall;
        const hasLocalBadge = badge && badgeSet && badgeSet.has(badge);
        const badgeImg = hasLocalBadge ? `assets/achievement-badges/${badge}.png` : toMedia(achievement.BadgeURL) || (badge ? badgeUrl(badge) : "");
        const title = achievement.Title || achievement.title || achievement.AchievementTitle || "Achievement";
        const game = achievement.GameTitle || achievement.gameTitle || achievement.GameName || achievement.Game || "";
        return `
          <div class="ticker-item">
            <img src="${badgeImg}" alt="" loading="lazy" />
            <div>
              <div class="ticker-title">${title}</div>
              <div class="ticker-game">${game}</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function pickValue(source, keys) {
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
    return undefined;
  }

  async function apiCall(endpoint, params) {
    if (!config.username || !config.apiKey) {
      throw new Error("Missing username or API key.");
    }
    const url = new URL(endpoint, API_ROOT);
    const search = new URLSearchParams({
      z: config.username,
      y: config.apiKey,
      u: config.username,
      ...params
    });
    url.search = search.toString();

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }
    const data = await response.json();
    if (data && data.Error) {
      throw new Error(data.Error);
    }
    return data;
  }

  async function fetchGameProgress(gameId) {
    if (!gameId) return null;
    return apiCall("API_GetGameInfoAndUserProgress.php", { g: gameId });
  }

  function renderProfile(profile, summary, detail, consoleMap, gameProgress) {
    const data = { ...summary, ...detail, ...profile };
    elements.points.textContent = formatNumber(
      pickValue(data, ["TotalPoints", "Points", "PointsSoftcore", "TotalSoftcorePoints"])
    );
    elements.truePoints.textContent = formatNumber(
      pickValue(data, ["TotalTruePoints", "TruePoints", "TotalTruePoint"])
    );
    elements.profileName.textContent = data.User || config.username || "--";
    elements.profileMotto.textContent = data.Motto || "Signal quiet";
    elements.rank.textContent = formatNumber(
      pickValue(data, ["Rank", "TotalRank", "RankSoftcore", "UserRank"])
    );
    elements.presenceMsg.textContent = data.RichPresenceMsg || data.Motto || "Signal quiet";

    const lastTitle =
      (data.LastGame && data.LastGame.Title) || data.LastGameTitle || data.LastGame || "Unknown";
    elements.presenceGame.textContent = lastTitle;

    const iconPath =
      (data.LastGame && data.LastGame.ImageIcon) ||
      data.LastGameIcon ||
      data.LastGameImage ||
      data.LastGameIconURL;
    const iconUrl = toMedia(iconPath);
    if (iconUrl) {
      elements.presenceIcon.src = iconUrl;
      elements.presenceIcon.alt = lastTitle;
    }

    const consoleName =
      (data.LastGame && data.LastGame.ConsoleName) || data.ConsoleName || data.LastConsoleName || "";
    const consoleId = (data.LastGame && data.LastGame.ConsoleID) || data.ConsoleID || "";
    elements.presenceConsoleName.textContent = consoleName || "--";
    const consoleIcon = consoleIconUrl(consoleId, consoleMap);
    if (consoleIcon) {
      elements.presenceConsoleIcon.src = consoleIcon;
      elements.presenceConsoleIcon.alt = consoleName;
      elements.presenceConsoleIcon.onerror = () => {
        elements.presenceConsoleIcon.onerror = null;
        elements.presenceConsoleIcon.src = `${SITE_ROOT}Images/Console/${consoleId}.webp`;
      };
    } else {
      elements.presenceConsoleIcon.removeAttribute("src");
    }

    const lastGameId = data.LastGameID || (data.LastGame && data.LastGame.ID);
    if (gameProgress && gameProgress.ID && Number(gameProgress.ID) === Number(lastGameId)) {
      const earned = Number(gameProgress.NumAwardedToUser || 0);
      const total = Number(gameProgress.NumAchievements || 0);
      elements.presenceAchCount.textContent = `${earned}/${total}`;
    } else {
      elements.presenceAchCount.textContent = "--";
    }

    const userPic = userPicUrl(data.UserPic || data.UserPicURL || "");
    if (userPic) {
      elements.profileAvatar.src = userPic;
      elements.profileAvatar.alt = data.User || config.username || "";
    }
  }

  function renderAchievements(data, badgeSet) {
    const items = ensureArray(data.RecentAchievements || data.Recent || data.Achievements || data);
    elements.achievementsGrid.innerHTML = "";

    if (!items.length) {
      setStatus(elements.statusAchievements, "No achievements found.");
      return;
    }

    const sorted = [...items].sort((a, b) => parseAchievementDate(b) - parseAchievementDate(a));
    setStatus(elements.statusAchievements, `${Math.min(8, sorted.length)} latest`);

    sorted.slice(0, 8).forEach((achievement) => {
      const badge =
        achievement.BadgeName || achievement.badgeName || achievement.Badge || achievement.BadgeNameSmall;
      const hasLocalBadge = badge && badgeSet && badgeSet.has(badge);
      const badgeImg = hasLocalBadge ? `assets/achievement-badges/${badge}.png` : toMedia(achievement.BadgeURL) || (badge ? badgeUrl(badge) : "");
      const gameIcon = toMedia(achievement.GameIcon || achievement.Icon || achievement.ImageIcon);
      const image = badgeImg || gameIcon;
      const title = achievement.Title || achievement.title || achievement.AchievementTitle || "Achievement";
      const game = achievement.GameTitle || achievement.gameTitle || achievement.GameName || achievement.Game || "";
      const desc = achievement.Description || achievement.description || "";
      const points = achievement.Points || achievement.points || achievement.Score || 0;
      const date = achievement.Date || achievement.date || achievement.DateEarned || achievement.UnlockedAt || "";

      const card = document.createElement("article");
      card.className = "achievement-card";
      card.innerHTML = `
        <div class="achievement-header">
          <img src="${image}" alt="" loading="lazy" />
          <div>
            <div class="achievement-title">${title}</div>
            <div class="achievement-game">${game}</div>
          </div>
        </div>
        <div class="achievement-desc">${desc}</div>
        <div class="achievement-meta">
          <span>${points} pts</span>
          <span>${formatDate(date)}</span>
        </div>
      `;
      elements.achievementsGrid.appendChild(card);
    });
  }

  function renderCompletion(progressData, awardsData) {
    const list = ensureArray(progressData?.Results || progressData?.CompletionProgress || progressData?.GameList || progressData);
    const mastered = [];
    const beaten = [];
    const masteredIds = new Set();

    list.forEach((game) => {
      const total = Number(game.MaxPossible || game.NumAchievements || game.NumAch || game.NumTotal || 0);
      const earned = Number(game.NumAwarded || game.NumAchieved || game.NumEarned || 0);
      const hardcore = Number(game.NumAwardedHardcore || game.NumAchievedHardcore || 0);
      if (!total) return;
      const awardDate = formatDateTime(game.HighestAwardDate || game.MostRecentAwardedDate);

      const entry = {
        title: game.GameTitle || game.Title || game.GameName || "Unknown",
        icon: toMedia(game.ImageIcon || game.GameIcon || game.Icon),
        console: game.ConsoleName || game.SystemName || "",
        progress: Math.min(100, Math.round((earned / total) * 100)),
        total,
        earned,
        hardcore,
        meta: awardDate
      };

      const gameId = Number(game.GameID || game.ID || 0);
      if (game.HighestAwardKind === "mastered" || hardcore >= total) {
        mastered.push(entry);
        if (gameId) masteredIds.add(gameId);
      }
    });

    const awards = ensureArray(awardsData?.VisibleUserAwards || awardsData);
    awards
      .filter((award) => award.AwardType === "Game Beaten")
      .forEach((award) => {
        const gameId = Number(award.AwardData || 0);
        if (gameId && masteredIds.has(gameId)) return;
        const awardDate = formatDateTime(award.AwardedAt);
        beaten.push({
          title: award.Title || "Unknown",
          icon: toMedia(award.ImageIcon),
          console: award.ConsoleName || "",
          progress: 100,
          total: 1,
          earned: 1,
          hardcore: 0,
          meta: awardDate || "Beaten"
        });
      });

    renderGameGrid(elements.masteredGrid, mastered, "No mastered games yet.");
    renderGameGrid(elements.completedGrid, beaten, "No beaten games yet.");
    setStatus(elements.statusCompletion, `${mastered.length} mastered, ${beaten.length} beaten`);
  }

  function renderGameGrid(target, items, emptyText) {
    target.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = emptyText;
      target.appendChild(empty);
      return;
    }

    items.forEach((game) => {
      const card = document.createElement("div");
      card.className = "game-card";
      card.innerHTML = `
        <img src="${game.icon}" alt="" loading="lazy" />
        <div>
          <div class="game-title">${game.title}</div>
          <div class="game-meta">${
            game.meta ? `${game.console} - ${game.meta}` : `${game.console} - ${game.earned}/${game.total}`
          }</div>
          <div class="progress"><span style="width:${game.progress}%"></span></div>
        </div>
      `;
      target.appendChild(card);
    });
  }

  function renderConsoleChart(completion, consoleMap) {
    if (!elements.consoleChart) return;
    const list = ensureArray(completion?.Results || completion?.CompletionProgress || completion?.GameList || completion);
    if (!list.length) {
      elements.consoleChart.innerHTML = "<div class=\"muted\">No console data.</div>";
      return;
    }

    const totals = new Map();
    list.forEach((game) => {
      const consoleName = game.ConsoleName || game.SystemName || "Unknown";
      const consoleId = Number(game.ConsoleID || 0);
      const earned = Number(game.NumAwarded || game.NumAchieved || 0);
      if (!earned) return;
      const entry = totals.get(consoleName) || { total: 0, id: consoleId };
      entry.total += earned;
      if (!entry.id && consoleId) entry.id = consoleId;
      totals.set(consoleName, entry);
    });

    const rows = [...totals.entries()].sort((a, b) => b[1].total - a[1].total);
    const maxValue = rows.length ? rows[0][1].total : 1;
    elements.consoleChart.innerHTML = rows
      .map(([name, value]) => {
        const percent = Math.max(4, Math.round((value.total / maxValue) * 100));
        const iconUrl = consoleIconUrl(value.id, consoleMap);
        return `
          <div class="bar-row">
            <div class="bar-label">
              ${iconUrl ? `<img src="${iconUrl}" alt="" loading="lazy" />` : ""}
              <span>${name}</span>
            </div>
            <div class="bar-track"><span class="bar-fill" style="width:${percent}%"></span></div>
            <div class="bar-value">${formatNumber(value.total)}</div>
          </div>
        `;
      })
      .join("");
  }

  function setupMotion() {
    let frame = null;
    window.addEventListener("mousemove", (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const x = event.clientX / window.innerWidth;
        const y = event.clientY / window.innerHeight;
        document.documentElement.style.setProperty("--mx", x.toFixed(3));
        document.documentElement.style.setProperty("--my", y.toFixed(3));
        frame = null;
      });
    });
  }

  async function loadAll() {
    if (!config.username || !config.apiKey) {
      setStatus(elements.statusAchievements, "Missing RA username or API key.");
      setStatus(elements.statusCompletion, "Waiting for credentials.");
      return;
    }

    try {
      const [profileRes, summaryRes, awardsRes, localConsoles, localBadges, localAchievements, localCompletion] = await Promise.allSettled([
        apiCall("API_GetUserProfile.php", {}),
        apiCall("API_GetUserSummary.php", {}),
        cachedCall("API_GetUserAwards.php", {}, 12 * 60 * 60 * 1000),
        fetchLocalJson(LOCAL_CACHE.consoles),
        fetchLocalJson(LOCAL_CACHE.badges),
        fetchLocalJson(LOCAL_CACHE.achievements),
        fetchLocalJson(LOCAL_CACHE.completion)
      ]);

      const profile = profileRes.status === "fulfilled" ? profileRes.value : {};
      const summary = summaryRes.status === "fulfilled" ? summaryRes.value : {};
      const awards = awardsRes.status === "fulfilled" ? awardsRes.value : null;
      let consoleMap = new Map();
      if (localConsoles.status === "fulfilled" && localConsoles.value) {
        consoleMap = new Map(
          ensureArray(localConsoles.value).map((consoleItem) => [Number(consoleItem.id), consoleItem.icon])
        );
      } else {
        const consolesRes = await Promise.allSettled([
          cachedCall("API_GetConsoleIDs.php", { a: 1 }, 7 * 24 * 60 * 60 * 1000)
        ]);
        const consoleList = consolesRes[0].status === "fulfilled" ? consolesRes[0].value : [];
        consoleMap = new Map(
          ensureArray(consoleList).map((consoleItem) => [Number(consoleItem.ID), consoleItem.IconURL])
        );
      }
      const localBadgeSet = localBadges.status === "fulfilled" && localBadges.value
        ? new Set(localBadges.value.badges || [])
        : new Set();
      const localAchievementList = localAchievements.status === "fulfilled" && localAchievements.value
        ? Object.values(localAchievements.value)
        : [];
      let libraryAchievements = [];
      let achievements = null;
      if (localAchievementList.length) {
        libraryAchievements = localAchievementList;
        achievements = localAchievementList;
      } else {
        try {
          libraryAchievements = await fetchAchievementLibrary(summary.MemberSince || profile.MemberSince);
        } catch (error) {
          console.warn("Achievement library fetch failed.", error);
        }
        try {
          achievements = await fetchRecentAchievements();
        } catch (error) {
          console.warn("Recent achievements fetch failed.", error);
        }
      }

      let completion = null;
      if (localCompletion.status === "fulfilled" && localCompletion.value) {
        completion = localCompletion.value;
      } else {
        try {
          const completionCacheKey = "ra-cache:completion-progress";
          const cachedCompletion = getCache(completionCacheKey, 12 * 60 * 60 * 1000);
          if (cachedCompletion) {
            completion = cachedCompletion;
          } else {
            const pageSize = 200;
            const firstPage = await apiCall("API_GetUserCompletionProgress.php", { o: 0, c: pageSize });
            const total = Number(firstPage.Total || firstPage.Count || 0);
            const results = ensureArray(firstPage.Results);
            if (total > results.length) {
              const pages = Math.ceil(total / pageSize);
              const requests = [];
              for (let page = 1; page < pages; page += 1) {
                requests.push(apiCall("API_GetUserCompletionProgress.php", { o: page * pageSize, c: pageSize }));
              }
              const settled = await Promise.allSettled(requests);
              settled.forEach((res) => {
                if (res.status === "fulfilled") {
                  results.push(...ensureArray(res.value.Results));
                }
              });
            }
            completion = { ...firstPage, Results: results };
            setCache(completionCacheKey, completion);
          }
        } catch (error) {
          console.warn("Completion progress fetch failed.", error);
        }
      }

      let detail = {};
      if (summary.LastGameID) {
        try {
          detail = await apiCall("API_GetUserSummary.php", { g: summary.LastGameID });
        } catch (error) {
          console.warn("Detail summary fetch failed.", error);
        }
      }

      let gameProgress = null;
      if (summary.LastGameID) {
        try {
          gameProgress = await fetchGameProgress(summary.LastGameID);
        } catch (error) {
          console.warn("Game progress fetch failed.", error);
        }
      }

      if (completion && completion.Results) {
        const totals = completion.Results.reduce(
          (acc, game) => {
            acc.total += Number(game.NumAwarded || 0);
            acc.hardcore += Number(game.NumAwardedHardcore || 0);
            return acc;
          },
          { total: 0, hardcore: 0 }
        );
        elements.achHardcore.textContent = formatNumber(totals.hardcore);
        elements.achSoftcore.textContent = formatNumber(Math.max(0, totals.total - totals.hardcore));
      }

      renderProfile(profile, summary, detail, consoleMap, gameProgress);

      if (achievements && achievements.length) {
        renderAchievements(achievements, localBadgeSet);
      } else {
        setStatus(elements.statusAchievements, "Recent achievements unavailable.");
      }

      if (libraryAchievements.length) {
        renderTicker(libraryAchievements, localBadgeSet);
      } else if (achievements && achievements.length) {
        renderTicker(achievements, localBadgeSet);
      }

      if (completion || awards) {
        renderCompletion(completion, awards);
        if (completion) {
          renderConsoleChart(completion, consoleMap);
        }
      } else {
        setStatus(elements.statusCompletion, "Completion data unavailable.");
      }

      elements.lastUpdated.textContent = `Last sync: ${new Date().toLocaleString()}`;
    } catch (error) {
      console.error(error);
      setStatus(elements.statusAchievements, "Signal error.");
      setStatus(elements.statusCompletion, error.message || "Signal error.");
    }
  }

  setupMotion();
  loadAll();
})();
