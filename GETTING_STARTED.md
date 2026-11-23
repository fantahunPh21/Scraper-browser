# Getting Started with Scraper Browser

**Scraper Browser** is a headless browser automation server and Model Context Protocol (MCP) tool suite powered by **Camoufox** (Firefox with C++ anti-fingerprinting). It bypasses Cloudflare, Google bot detection, and modern anti-scraping protections while providing token-efficient accessibility snapshots with stable element refs (`e1`, `e2`...).

---

## 1. Quick Start (Running the Server)

### Start Locally
```bash
npm start
# Server listens on http://localhost:9377
```

- **Interactive API Documentation (Swagger)**: [http://localhost:9377/docs](http://localhost:9377/docs)
- **OpenAPI 3.0 Specification**: [http://localhost:9377/openapi.json](http://localhost:9377/openapi.json)
- **Health Check**: `GET http://localhost:9377/health`

---

## 2. Using with AI Assistants (MCP / Model Context Protocol)

Scraper Browser includes a built-in stdio MCP server. You can integrate it into **Claude Code, Cursor, Codex, OpenClaw, or Antigravity** so AI assistants can browse the web on your behalf.

### MCP Client Configuration

Add this to your MCP settings file (e.g., `claude_desktop_config.json` or Cursor MCP settings):

```json
{
  "mcpServers": {
    "scraper-browser": {
      "command": "node",
      "args": ["C:/Users/Fantahun.fkadie/Downloads/camofox-browser-master/mcp/server.mjs"]
    }
  }
}
```

### Available Tools (31 Tools)
- **Tabs & Navigation**: `scraper_create_tab`, `scraper_list_tabs`, `scraper_close_tab`, `scraper_navigate`, `scraper_back`, `scraper_forward`, `scraper_refresh`, `scraper_wait`
- **Reading the Page**: `scraper_snapshot`, `scraper_ax`, `scraper_actionables`, `scraper_table_rows`, `scraper_links`, `scraper_images`, `scraper_extract`, `scraper_screenshot`
- **Interactions**: `scraper_click`, `scraper_type`, `scraper_press`, `scraper_select`, `scraper_scroll`, `scraper_mouse_wheel`, `scraper_drag`, `scraper_upload`, `scraper_viewport`
- **State & Scripting**: `scraper_evaluate`, `scraper_init_script`, `scraper_import_cookies`, `scraper_export_storage_state`, `scraper_import_local_storage`

*(Note: Legacy `camofox_*` tool aliases are also accepted for backward compatibility).*

---

## 3. Working via HTTP REST API

You can automate scraping and browsing from any programming language (Python, Node.js, Go, cURL, etc.).

### Python Example

```python
import requests

BASE_URL = "http://localhost:9377"
USER_ID = "agent_python"

# 1. Open a new anti-detection tab
tab = requests.post(f"{BASE_URL}/tabs", json={
    "userId": USER_ID,
    "sessionKey": "task1",
    "url": "https://news.ycombinator.com"
}).json()

tab_id = tab["tabId"]
print(f"Created Tab ID: {tab_id}")

# 2. Get the clean accessibility snapshot (with element refs like e1, e2...)
snapshot = requests.get(
    f"{BASE_URL}/tabs/{tab_id}/snapshot",
    params={"userId": USER_ID}
).json()

print("\n--- Accessibility Tree ---")
print(snapshot["snapshot"])

# 3. Click an element using ref (e.g. e1)
requests.post(f"{BASE_URL}/tabs/{tab_id}/click", json={
    "userId": USER_ID,
    "ref": "e1"
})

# 4. Close the tab when finished
requests.delete(f"{BASE_URL}/tabs/{tab_id}", params={"userId": USER_ID})
print("Tab closed.")
```

### Node.js Example

```javascript
const BASE_URL = 'http://localhost:9377';
const userId = 'agent_node';

// 1. Create a tab using a search macro
const res = await fetch(`${BASE_URL}/tabs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId,
    macro: '@google_search',
    query: 'best anti detection browser'
  })
});
const { tabId } = await res.json();

// 2. Extract links found on the page
const links = await fetch(`${BASE_URL}/tabs/${tabId}/links?userId=${userId}`).then(r => r.json());
console.log('Found Links:', links);

// 3. Close the tab
await fetch(`${BASE_URL}/tabs/${tabId}?userId=${userId}`, { method: 'DELETE' });
```

---

## 4. Key Features & Superpowers

### Search Macros
Instead of manually crafting search query URLs, pass a search macro directly:

| Macro | Destination |
| :--- | :--- |
| `@google_search` | Google Search |
| `@youtube_search` | YouTube |
| `@amazon_search` | Amazon |
| `@reddit_search` | Reddit |
| `@wikipedia_search` | Wikipedia |
| `@twitter_search` | X / Twitter |
| `@linkedin_search` | LinkedIn |

```bash
POST /tabs/:tabId/navigate
{"userId": "agent1", "macro": "@google_search", "query": "weather forecast"}
```

### YouTube Transcript Extraction
Extract captions/transcripts from YouTube videos without needing an API key:
```bash
POST /youtube/transcript
{"url": "https://www.youtube.com/watch?v=VIDEO_ID", "lang": "en"}
```

### Session & Cookie Persistence
Pass a consistent `userId` across requests to maintain logins, cookies, and localStorage saved under `~/.scraper/profiles/<userId>/`.

### Configuration Options (`scraper.config.json` & Environment Variables)

You can customize runtime behavior in `scraper.config.json` or with environment variables:

| Setting | Environment Variable | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `port` | `SCRAPER_PORT` | `9377` | Server HTTP port |
| `newPageTimeoutMs` | `SCRAPER_NEW_PAGE_TIMEOUT_MS` | `30000` | Browser window creation timeout (ms) |
| `profileDir` | `SCRAPER_PROFILE_DIR` | `~/.scraper/profiles` | Directory for persistent storage state |
| `cookiesDir` | `SCRAPER_COOKIES_DIR` | `~/.scraper/cookies` | Directory for importing cookie files |
| `apiKey` | `SCRAPER_API_KEY` | `""` | Key for cookie import endpoint |
| `accessKey` | `SCRAPER_ACCESS_KEY` | `""` | Global bearer token for securing all endpoints |
