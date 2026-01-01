(() => {
  const API_ROOT = "https://retroachievements.org/API/";
  const MEDIA_ROOT = "https://media.retroachievements.org/";
  const SITE_ROOT = "https://retroachievements.org/";

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
    tickerTrack: document.getElementById("ticker-track")
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
    return `${SITE_ROOT}Images/Console/${consoleId}.png`;
  }

  function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return Object.values(value);
  }

  async function fetchRecentAchievements() {
    const now = Math.floor(Date.now() / 1000);
    const ranges = [3, 7, 30, 90, 365, 3650];
    let fallback = [];
    for (const days of ranges) {
      const from = now - days * 86400;
      const data = await apiCall("API_GetAchievementsEarnedBetween.php", { f: from, t: now });
      const items = ensureArray(data);
      if (items.length >= 8) return items;
      if (items.length > fallback.length) fallback = items;
    }
    return fallback;
  }

  async function fetchAchievementLibrary(memberSince) {
    const now = Math.floor(Date.now() / 1000);
    const fromDate = memberSince ? Math.floor(new Date(memberSince).getTime() / 1000) : now - 3650 * 86400;
    const data = await apiCall("API_GetAchievementsEarnedBetween.php", { f: fromDate, t: now });
    return ensureArray(data);
  }

  function shuffleArray(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function renderTicker(items) {
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
        const badge = achievement.BadgeName || achievement.Badge || achievement.BadgeNameSmall;
        const badgeImg = toMedia(achievement.BadgeURL) || (badge ? badgeUrl(badge) : "");
        const title = achievement.Title || achievement.AchievementTitle || "Achievement";
        const game = achievement.GameTitle || achievement.GameName || achievement.Game || "";
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

  function renderProfile(profile, summary, detail, consoleMap) {
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
    let awardedEntry = null;
    if (data.Awarded && lastGameId) {
      awardedEntry = data.Awarded[lastGameId] || data.Awarded[String(lastGameId)] || null;
    }
    if (awardedEntry) {
      const earned = Number(awardedEntry.NumAchieved || 0);
      const total = Number(awardedEntry.NumPossibleAchievements || 0);
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

  function renderAchievements(data) {
    const items = ensureArray(data.RecentAchievements || data.Recent || data.Achievements || data);
    elements.achievementsGrid.innerHTML = "";

    if (!items.length) {
      setStatus(elements.statusAchievements, "No achievements found.");
      return;
    }

    const sorted = [...items].sort((a, b) => {
      const aDate = new Date(a.Date || a.DateEarned || 0).getTime();
      const bDate = new Date(b.Date || b.DateEarned || 0).getTime();
      return bDate - aDate;
    });
    setStatus(elements.statusAchievements, `${Math.min(8, sorted.length)} latest`);

    sorted.slice(0, 8).forEach((achievement) => {
      const badge = achievement.BadgeName || achievement.Badge || achievement.BadgeNameSmall;
      const badgeImg = toMedia(achievement.BadgeURL) || (badge ? badgeUrl(badge) : "");
      const gameIcon = toMedia(achievement.GameIcon || achievement.Icon || achievement.ImageIcon);
      const image = badgeImg || gameIcon;
      const title = achievement.Title || achievement.AchievementTitle || "Achievement";
      const game = achievement.GameTitle || achievement.GameName || achievement.Game || "";
      const desc = achievement.Description || "";
      const points = achievement.Points || achievement.Score || 0;
      const date = achievement.Date || achievement.DateEarned || achievement.UnlockedAt || "";

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
      const [profileRes, summaryRes, awardsRes, consolesRes] = await Promise.allSettled([
        apiCall("API_GetUserProfile.php", {}),
        apiCall("API_GetUserSummary.php", {}),
        apiCall("API_GetUserAwards.php", {}),
        apiCall("API_GetConsoleIDs.php", { a: 1 })
      ]);

      const profile = profileRes.status === "fulfilled" ? profileRes.value : {};
      const summary = summaryRes.status === "fulfilled" ? summaryRes.value : {};
      const awards = awardsRes.status === "fulfilled" ? awardsRes.value : null;
      const consoleList = consolesRes.status === "fulfilled" ? consolesRes.value : [];
      const consoleMap = new Map(
        ensureArray(consoleList).map((consoleItem) => [Number(consoleItem.ID), consoleItem.IconURL])
      );
      let libraryAchievements = [];
      try {
        libraryAchievements = await fetchAchievementLibrary(summary.MemberSince || profile.MemberSince);
      } catch (error) {
        console.warn("Achievement library fetch failed.", error);
      }
      let achievements = null;
      try {
        achievements = await fetchRecentAchievements();
      } catch (error) {
        console.warn("Recent achievements fetch failed.", error);
      }

      let completion = null;
      try {
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
      } catch (error) {
        console.warn("Completion progress fetch failed.", error);
      }

      let detail = {};
      if (summary.LastGameID) {
        try {
          detail = await apiCall("API_GetUserSummary.php", { g: summary.LastGameID });
        } catch (error) {
          console.warn("Detail summary fetch failed.", error);
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

      renderProfile(profile, summary, detail, consoleMap);

      if (achievements && achievements.length) {
        renderAchievements(achievements);
      } else {
        setStatus(elements.statusAchievements, "Recent achievements unavailable.");
      }

      if (libraryAchievements.length) {
        renderTicker(libraryAchievements);
      } else if (achievements && achievements.length) {
        renderTicker(achievements);
      }

      if (completion || awards) {
        renderCompletion(completion, awards);
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
