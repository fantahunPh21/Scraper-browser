import os from 'node:os';
import { join } from 'node:path';

/**
 * Load only the environment settings the standalone MCP adapter requires.
 * This module intentionally does not import the core server configuration so
 * @askjo/camofox-browser-mcp can run without the core package installed.
 */
export function loadMcpConfig() {
  return {
    port: parseInt((process.env.SCRAPER_PORT || process.env.CAMOFOX_PORT) || process.env.PORT || '9377', 10),
    apiKey: (process.env.SCRAPER_API_KEY || process.env.CAMOFOX_API_KEY) || '',
    accessKey: ((process.env.SCRAPER_ACCESS_KEY || process.env.CAMOFOX_ACCESS_KEY) || '').trim(),
    cookiesDir: (process.env.SCRAPER_COOKIES_DIR || process.env.CAMOFOX_COOKIES_DIR) || join(os.homedir(), '.scraper', 'cookies'),
    allowedUserIds: ((process.env.SCRAPER_MCP_USER_IDS || process.env.CAMOFOX_MCP_USER_IDS) || '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}
