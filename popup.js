document.addEventListener("DOMContentLoaded", () => {
  const enableToggle = document.getElementById("enableToggle");
  const rulesList = document.getElementById("rulesList");
  const emptyState = document.getElementById("emptyState");
  const rulesCount = document.getElementById("rulesCount");

  let customRules = [];

  // 鍵值正規化：與 content.js 相同，確保規則格式一致。
  const normalizeKey = (key) => {
    return key.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
  };

  const escapeHtml = (str) => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // 載入初始狀態與規則列表
  chrome.storage.local.get(["isEnabled", "customRules"], (result) => {
    const isEnabled = result.isEnabled !== false;
    customRules = result.customRules || [];

    enableToggle.checked = isEnabled;
    renderRules();
  });

  // 渲染規則列表
  const renderRules = () => {
    rulesList.innerHTML = "";
    rulesCount.textContent = customRules.length;

    if (customRules.length === 0) {
      emptyState.style.display = "flex";
      rulesList.style.display = "none";
    } else {
      emptyState.style.display = "none";
      rulesList.style.display = "block";

      customRules.forEach((rule, index) => {
        const li = document.createElement("li");
        li.className = "rule-item";
        li.innerHTML = `
          <div class="rule-text">
            <span class="rule-key" title="${escapeHtml(rule.key)}">${escapeHtml(rule.key)}</span>
            <span class="rule-arrow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14"></path>
                <path d="M12 5l7 7-7 7"></path>
              </svg>
            </span>
            <span class="rule-replacement" title="${escapeHtml(rule.replacement)}">${escapeHtml(rule.replacement)}</span>
          </div>
          <button class="btn-delete" data-index="${index}" title="刪除此規則">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
          </button>
        `;
        rulesList.appendChild(li);
      });
    }
  };

  // 廣播更新通知給所有分頁
  const notifyTabs = () => {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs
            .sendMessage(tab.id, { action: "updateRules" })
            .catch(() => {
              // 忽略未注入 Content Script 的分頁
            });
        }
      }
    });
  };

  // 儲存狀態至 chrome.storage 並更新分頁
  const saveAndSync = () => {
    chrome.storage.local.set(
      {
        isEnabled: enableToggle.checked,
        customRules: customRules,
      },
      () => {
        notifyTabs();
      },
    );
  };

  enableToggle.addEventListener("change", () => {
    saveAndSync();
  });

  // 刪除規則事件委派
  rulesList.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".btn-delete");
    if (!deleteBtn) return;

    const index = parseInt(deleteBtn.getAttribute("data-index"), 10);
    if (isNaN(index)) return;

    // 移除指定的規則
    customRules.splice(index, 1);

    renderRules();
    saveAndSync();
  });

  // ----- 批次匯入功能 -----
  const batchInput = document.getElementById("batchInput");
  const batchImportBtn = document.getElementById("batchImportBtn");
  const importResult = document.getElementById("importResult");

  // 清除錯誤樣式
  batchInput.addEventListener("input", () => {
    batchInput.classList.remove("error");
    importResult.textContent = "";
    importResult.className = "import-result";
  });

  batchImportBtn.addEventListener("click", () => {
    const raw = batchInput.value.trim();
    if (!raw) {
      batchInput.classList.add("error");
      importResult.textContent = "請輸入要匯入的規則";
      importResult.className = "import-result error";
      return;
    }

    const lines = raw.split("\n");
    let imported = 0;
    let skipped = 0;
    let firstError = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue; // 跳過空行

      // 分隔符：第一個空格
      const sepIndex = trimmed.indexOf(" ");
      if (sepIndex === -1) {
        skipped++;
        if (!firstError) firstError = `格式錯誤：${trimmed}`;
        continue;
      }

      const key = trimmed.slice(0, sepIndex).trim();
      const replacement = trimmed.slice(sepIndex + 1).trim();

      if (!key || !normalizeKey(key) || !replacement) {
        skipped++;
        if (!firstError) firstError = `格式錯誤：${trimmed}`;
        continue;
      }

      // 檢查重複，比照 addBtn 邏輯。
      const normKey = normalizeKey(key);
      const existingIndex = customRules.findIndex(
        (r) => normalizeKey(r.key) === normKey,
      );
      if (existingIndex > -1) {
        customRules[existingIndex].key = key;
        customRules[existingIndex].replacement = replacement;
      } else customRules.push({ key, replacement });
      imported++;
    }

    batchInput.value = "";
    batchInput.classList.remove("error");

    if (imported > 0) {
      renderRules();
      saveAndSync();
      const msg =
        `✓ 成功匯入 ${imported} 條規則` +
        (skipped > 0 ? `（${skipped} 條跳過）` : "");
      importResult.textContent = msg;
      importResult.className = "import-result";
    } else {
      importResult.textContent = firstError || "沒有任何規則被匯入";
      importResult.className = "import-result error";
      batchInput.classList.add("error");
    }
  });
});
