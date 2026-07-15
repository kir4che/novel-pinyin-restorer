const IGNORED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "TEXTAREA",
  "INPUT",
  "NOSCRIPT",
  "IFRAME",
  "CODE",
  "PRE",
]);

const NOVEL_CONTENT_SELECTORS = [
  "article",
  ".content",
  ".read-content",
  ".novel-content",
  "#content",
  "#novel-content",
];

let isEnabled = true;
let compiledRules = [];
let observer = null;

// 鍵值正規化：統一轉為小寫，並自動將常見的數字變體還原為標準拼音。
const normalizeKey = (key) => {
  if (!key) return "";
  return key
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "") // 移除特殊符號
    .replace(/0/g, "o") // 將數字 0 映射回字母 o
    .replace(/1/g, "i") // 將數字 1 映射回字母 i
    .replace(/3/g, "e") // 將數字 3 映射回字母 e
    .replace(/4/g, "a"); // 將數字 4 映射回字母 a
};

// 恢復所有被修改過文字的節點內容為原始狀態
const restoreOriginalText = () => {
  if (!document.body) return;
  const iterator = document.createNodeIterator(
    document.body,
    NodeFilter.SHOW_TEXT,
  );

  let node;
  while ((node = iterator.nextNode())) {
    if (node.__originalText !== undefined) node.nodeValue = node.__originalText;
  }
};

// 判斷元素是否應該被處理（排除特定標籤）
const shouldProcessElement = (element) => {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return true;
  return !IGNORED_TAGS.has(element.tagName);
};

// 遞迴遍歷 DOM 節點，對文字節點進行替換。
const walk = (node, rules) => {
  if (!node) return;

  if (node.nodeType === Node.TEXT_NODE) {
    let text = node.nodeValue;
    // 效能優化：如果不含英文或數字，直接跳過比對
    if (!/[a-zA-Z0-9]/.test(text)) return;

    let modified = false;
    for (const rule of rules) {
      rule.regex.lastIndex = 0;
      if (rule.regex.test(text)) {
        rule.regex.lastIndex = 0;
        text = text.replace(rule.regex, rule.replacement);
        modified = true;
      }
    }

    if (modified) {
      if (node.__originalText === undefined)
        node.__originalText = node.nodeValue;
      node.nodeValue = text;
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    if (shouldProcessElement(node)) {
      for (let child = node.firstChild; child; child = child.nextSibling)
        walk(child, rules);
    }
  }
};

// 編譯所有規則，將自訂規則與內建規則合併，並生成正規表示式。
const compileAllRules = (customRules) => {
  const rulesMap = new Map();

  // 1. 載入內建規則
  for (const rule of DEFAULT_RULES) {
    const normKey = normalizeKey(rule.key);
    if (normKey) rulesMap.set(normKey, rule.replacement);
  }

  // 2. 載入使用者自訂規則（自訂優先權高於內建）
  for (const rule of customRules) {
    const normKey = normalizeKey(rule.key);
    if (normKey) rulesMap.set(normKey, rule.replacement);
  }

  // 3. 轉為陣列並按長度由長到短排序
  const sortedRules = [];
  for (const [normKey, replacement] of rulesMap.entries()) {
    sortedRules.push({ normKey, replacement });
  }
  sortedRules.sort((a, b) => b.normKey.length - a.normKey.length);

  // 4. 編譯為智能正規表示式
  compiledRules = sortedRules.map((rule) => {
    // 針對每個字母進行模糊映射匹配
    const charsPattern = [...rule.normKey].map((c) => {
      // 核心演算法：在正規表示式端支持數字/形似字元混寫
      if (c === "o") return "[o0]";
      if (c === "i") return "[i1l]";
      if (c === "e") return "[e3]";
      if (c === "a") return "[a4]";
      return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // 轉義普通正規字元
    });

    // 允許字母或數字中間夾雜任意數量的干擾符號（如 _、*、-、空白）
    const pattern = charsPattern.join("[^a-zA-Z0-9\\u4e00-\\u9fa5]*");

    return {
      regex: new RegExp(pattern, "gi"),
      replacement: rule.replacement,
    };
  });
};

// 尋找網頁版面中的小說主內容區塊
const getNovelContainers = () => {
  const containers = [];
  for (const selector of NOVEL_CONTENT_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      if (shouldProcessElement(el)) containers.push(el);
    });
  }
  // 如果精準搜尋失敗，退而求其次選擇 body 節點。
  return containers.length > 0 ? containers : [document.body];
};

// 執行文字替換
const executeTranslation = () => {
  if (!document.body) return;
  const targets = getNovelContainers();
  targets.forEach((target) => walk(target, compiledRules));
};

// 啟動 DOM 監聽器，動態處理新增的節點。
const startObserver = () => {
  if (observer || !document.body) return;

  observer = new MutationObserver((mutations) => {
    if (!isEnabled) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        // 只對通過安全檢查的節點執行 walk
        if (node.nodeType === Node.TEXT_NODE) walk(node, compiledRules);
        else if (
          node.nodeType === Node.ELEMENT_NODE &&
          shouldProcessElement(node)
        )
          walk(node, compiledRules);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
};

// 停止監聽
const stopObserver = () => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
};

// 載入設定並套用規則
const loadAndApply = () => {
  chrome.storage.local.get(["isEnabled", "customRules"], (result) => {
    isEnabled = result.isEnabled !== false;
    const customRules = result.customRules || [];

    // 1. 恢復網頁至最原始的文字
    restoreOriginalText();

    // 2. 重新編譯規則（應用 o->[o0] 模糊演算法）
    compileAllRules(customRules);

    if (isEnabled) {
      // 3. 執行精準替換
      executeTranslation();
      // 4. 啟動動態監聽
      startObserver();
    } else stopObserver(); // 5. 若關閉，停止監聽。
  });
};

// 監聽來自 Popup 或 Background 的通知
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateRules") {
    loadAndApply();
    if (sendResponse) sendResponse({ status: "success" });
  }

  // 右鍵選單：選取拼音後加入還原規則
  if (message.action === "contextMenuAddRule") {
    const selectedText = (message.selectedText || "").trim();
    if (!selectedText) {
      if (sendResponse) sendResponse({ status: "error", reason: "no text" });
      return;
    }

    const replacement = prompt(`請輸入「${selectedText}」對應的中文：`);
    if (!replacement) {
      if (sendResponse) sendResponse({ status: "cancelled" });
      return;
    }

    chrome.storage.local.get(["customRules"], (result) => {
      const customRules = result.customRules || [];
      const normKey = normalizeKey(selectedText);
      const existingIndex = customRules.findIndex(
        (r) => normalizeKey(r.key) === normKey,
      );
      if (existingIndex > -1) {
        customRules[existingIndex].key = selectedText;
        customRules[existingIndex].replacement = replacement;
      } else customRules.push({ key: selectedText, replacement });
      chrome.storage.local.set({ customRules }, () => {
        loadAndApply();
      });
    });
    if (sendResponse) sendResponse({ status: "processing" });
  }
});

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", loadAndApply);
else loadAndApply();
