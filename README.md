# 成人小說拼音還原助手

自動將成人小說網頁中為了規避審查而使用的拼音、英文縮寫與火星文還原為正確的中文。

## 功能

- 自動偵測頁面中的拼音/火星文並替換為中文
- 預設內建成人詞典（編輯 `rules.js` 即可擴充）
- 批次匯入自訂規則，一次貼入多組拼音對照
- 右鍵選取拼音快速加入還原規則
- 模糊字元匹配：`0→o` `1→i` `3→e` `4→a`，符號干擾自動過濾
- 小說內容區塊精準定位，避免破壞導覽列與選單
- 動態 DOM 監聽，支援 SPA 網站
- 啟用/關閉開關

## 使用

1. 安裝擴充功能後，圖示出現在工具列
2. 點擊圖示可開啟/關閉轉換功能
3. 開啟時自動偵測當前頁面並進行轉換
4. 新增還原規則：
   - 選取網頁中的拼音 → 右鍵 →「加入拼音還原規則」
   - 或點擊圖示，在 popup 中使用「匯入規則」一次貼入多條
5. 自訂規則格式：每行一組 `拼音 空格 中文`

## 自訂詞典

編輯專案中的 `rules.js`，直接增刪 `DEFAULT_RULES` 陣列即可（內建皆為成人詞彙，可依需求自行調整）。

格式：

```
{ key: "pinyin", replacement: "中文" },
```


## 單檔安裝（.crx）

使用者只需下載一個 `.crx` 檔案，拖入 `chrome://extensions` 即可安裝，裝完可刪。

### 第一次準備（開發者）

```bash
# 1. 產生私鑰（永久保留，不要遺失）
openssl genrsa -out key.pem 2048

# 2. Base64 編碼後加入 GitHub Secrets（名稱 CRX_PRIVATE_KEY）
base64 -i key.pem | pbcopy
```

### 打包 .crx

**方式一（Chrome 128+ 不支援指令打包，用 GUI）：**
1. `chrome://extensions` → 開發人員模式 ON
2. 點「封裝擴充功能」
3. 根目錄選此專案，私密金鑰選 `key.pem`
4. 產出 `novel-pinyin-restorer.crx`

**方式二（npm crx 套件，可離線執行）：**
```bash
npx crx pack ./ -o novel-pinyin-restorer.crx -p key.pem
```

### 自動發行（GitHub Actions）

打 tag 即自動打包：

```bash
git tag v1.0.0
git push origin v1.0.0
```

### 使用者安裝

1. 從 GitHub Releases 下載 `novel-pinyin-restorer.crx`
2. 打開 `chrome://extensions`
3. 開啟「開發人員模式」
4. 拖入 `.crx` 檔案 → 點「安裝」
5. 裝完可刪除 `.crx`（不像 zip 需保留資料夾）
