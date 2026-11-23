/**
 * Centralized environment configuration for scraper-browser (formerly camofox-browser).
 *
 * All process.env access is centralized here for auditability.
 * Checks SCRAPER_* environment variables first, falling back to CAMOFOX_* for backwards compatibility.
 */

import { join, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

const CONFIG_PATH = [
  join(ROOT_DIR, 'scraper.config.json'),
  join(ROOT_DIR, 'camofox.config.json'),
].find(p => {
  try { return existsSync(p); } catch { return false; }
}) || join(ROOT_DIR, 'scraper.config.json');

function readCamofoxConfig(configPath = CONFIG_PATH) {
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Helper to get env variable with SCRAPER_ first, then CAMOFOX_ fallback */
function getEnv(key, env = process.env, fallback = '') {
  return env['SCRAPER_' + key] ?? env['CAMOFOX_' + key] ?? fallback;
}

/** @deprecated crashReporter config moved to Cloudflare Worker relay. */
function readCrashReporterConfig() {
  return {};
}

/**
 * Parse PROXY_PORTS env var into an array of port numbers.
 * Supports range ("10001-10010") or comma-separated ("10001,10002,10003").
 * Falls back to single PROXY_PORT if PROXY_PORTS is not set.
 */
function parseProxyPorts(portsEnv, singlePort) {
  if (portsEnv) {
    if (portsEnv.includes('-')) {
      const [start, end] = portsEnv.split('-').map(s => parseInt(s.trim(), 10));
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
      }
    }
    const parsed = portsEnv.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    if (parsed.length > 0) return parsed;
  }
  if (singlePort) {
    const p = parseInt(singlePort, 10);
    if (!isNaN(p)) return [p];
  }
  return [];
}

function inferProxyStrategy(explicitStrategy) {
  if (explicitStrategy) return explicitStrategy;
  return 'round_robin';
}

function parsePositiveTimeoutMs(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647 ? parsed : fallback;
}

function camoufoxCacheDir(env = process.env) {
  const home = os.homedir();
  if (process.platform === 'darwin') return join(home, 'Library', 'Caches', 'camoufox');
  if (process.platform === 'win32') {
    const base = env.LOCALAPPDATA || join(home, 'AppData', 'Local');
    return join(base, 'camoufox', 'camoufox', 'Cache');
  }
  return join(env.XDG_CACHE_HOME || join(home, '.cache'), 'camoufox');
}

function camoufoxExecutablePath(env = process.env) {
  return (
    env.CAMOUFOX_EXECUTABLE ||
    env.CAMOUFOX_EXECUTABLE_PATH ||
    getEnv('EXECUTABLE_PATH', env) ||
    ''
  ).trim();
}

function normalizeInteractiveMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return ['off', 'desktop', 'novnc', 'auto'].includes(mode) ? mode : 'off';
}

function normalizeProxyProtocol(value) {
  const protocol = String(value || 'http').trim().toLowerCase().replace(/:$/, '');
  if (!['http', 'https', 'socks4', 'socks5'].includes(protocol)) {
    throw new Error('PROXY_PROTOCOL must be http, https, socks4, or socks5');
  }
  return protocol;
}

function directBrowserIdentity(env = process.env) {
  const locale = String(getEnv('LOCALE', env)).trim();
  const timezoneId = String(getEnv('TIMEZONE', env)).trim();
  if (!locale && !timezoneId) return null;
  if (!locale || !timezoneId) {
    throw new Error('SCRAPER_LOCALE/CAMOFOX_LOCALE and SCRAPER_TIMEZONE/CAMOFOX_TIMEZONE must be set together for direct browser identity');
  }
  try {
    Intl.getCanonicalLocales(locale);
  } catch {
    throw new Error('SCRAPER_LOCALE must be a valid BCP 47 locale');
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezoneId });
  } catch {
    throw new Error('SCRAPER_TIMEZONE must be a valid IANA timezone');
  }
  return { locale, timezoneId };
}

const FINGERPRINT_OS_VALUES = new Set(['windows', 'macos', 'linux']);

function fingerprintOs(env = process.env) {
  const value = String(getEnv('OS', env)).trim().toLowerCase();
  if (!value) return null;
  if (!FINGERPRINT_OS_VALUES.has(value)) {
    throw new Error('SCRAPER_OS/CAMOFOX_OS must be windows, macos, or linux');
  }
  return value;
}

function loadConfig({ configPath = CONFIG_PATH } = {}) {
  const externalCamoufoxExecutable = camoufoxExecutablePath();
  const configuredSessionTimeoutMs = parseInt(process.env.SESSION_TIMEOUT_MS, 10);
  const sessionTimeoutMs = Number.isNaN(configuredSessionTimeoutMs) ? 600000 : configuredSessionTimeoutMs;
  const configuredBrowserIdleTimeoutMs = parseInt(process.env.BROWSER_IDLE_TIMEOUT_MS, 10);
  const browserIdleTimeoutMs = Number.isNaN(configuredBrowserIdleTimeoutMs) ? 300000 : configuredBrowserIdleTimeoutMs;
  const shutdownTimeoutMs = parsePositiveTimeoutMs(getEnv('SHUTDOWN_TIMEOUT_MS', process.env, '45000'), 45000);
  const fileConfig = readCamofoxConfig(configPath);
  const configuredNewPageTimeoutMs = Number(fileConfig.newPageTimeoutMs);
  const newPageTimeoutMs = Number.isFinite(configuredNewPageTimeoutMs) && configuredNewPageTimeoutMs > 0
    ? configuredNewPageTimeoutMs
    : 30000;
  const configuredInteractiveMode = fileConfig.interactive?.mode;
  const interactiveMode = normalizeInteractiveMode(getEnv('INTERACTIVE', process.env) || configuredInteractiveMode);
  const directIdentity = directBrowserIdentity();
  return {
    port: parseInt(getEnv('PORT', process.env) || process.env.PORT || '9377', 10),
    bindHost: String(getEnv('BIND_HOST', process.env)).trim(),
    nodeEnv: process.env.NODE_ENV || 'development',
    flyMachineId: process.env.FLY_MACHINE_ID || '',
    flyAppName: process.env.FLY_APP_NAME || '',
    flyApiToken: process.env.FLY_API_TOKEN || '',
    adminKey: getEnv('ADMIN_KEY', process.env),
    apiKey: getEnv('API_KEY', process.env),
    accessKey: String(getEnv('ACCESS_KEY', process.env)).trim(),
    evaluateMaxBodySize: getEnv('EVALUATE_MAX_BODY_SIZE', process.env, '1mb'),
    cookiesDir: getEnv('COOKIES_DIR', process.env) || join(os.homedir(), '.scraper', 'cookies'),
    uploadsDir: getEnv('UPLOADS_DIR', process.env) || join(os.homedir(), '.scraper', 'uploads'),
    profileDir: getEnv('PROFILE_DIR', process.env) || join(os.homedir(), '.scraper', 'profiles'),
    tracesDir: getEnv('TRACES_DIR', process.env) || join(os.homedir(), '.scraper', 'traces'),
    tracesMaxBytes: parseInt(getEnv('TRACES_MAX_BYTES', process.env, String(50 * 1024 * 1024)), 10),
    tracesTtlHours: parseInt(getEnv('TRACES_TTL_HOURS', process.env, '24'), 10),
    handlerTimeoutMs: parseInt(process.env.HANDLER_TIMEOUT_MS) || 30000,
    shutdownTimeoutMs,
    newPageTimeoutMs,
    maxConcurrentPerUser: parseInt(process.env.MAX_CONCURRENT_PER_USER) || 3,
    sessionTimeoutMs,
    tabInactivityMs: parseInt(process.env.TAB_INACTIVITY_MS) || 300000,
    maxSessions: parseInt(process.env.MAX_SESSIONS) || 50,
    maxTabsPerSession: parseInt(process.env.MAX_TABS_PER_SESSION) || 10,
    maxTabsGlobal: parseInt(process.env.MAX_TABS_GLOBAL) || 50,
    navigateTimeoutMs: parseInt(process.env.NAVIGATE_TIMEOUT_MS) || 30000,
    buildrefsTimeoutMs: parseInt(process.env.BUILDREFS_TIMEOUT_MS) || 12000,
    browserIdleTimeoutMs,
    nativeMemRestartThresholdMb: parseInt(process.env.NATIVE_MEM_RESTART_THRESHOLD_MB) || 300,
    browserRssRestartThresholdMb: parseInt(process.env.BROWSER_RSS_RESTART_THRESHOLD_MB) || 1500,
    camoufoxExecutablePath: externalCamoufoxExecutable,
    camoufoxCacheDir: camoufoxCacheDir(),
    prometheusEnabled: process.env.PROMETHEUS_ENABLED === '1' || process.env.PROMETHEUS_ENABLED === 'true',
    disableDefaultAddons: getEnv('DISABLE_DEFAULT_ADDONS', process.env) === '1' || getEnv('DISABLE_DEFAULT_ADDONS', process.env) === 'true',
    interactiveMode,
    directIdentity,
    fingerprintOs: fingerprintOs(),
    proxy: {
      strategy: inferProxyStrategy(process.env.PROXY_STRATEGY || ''),
      protocol: normalizeProxyProtocol(process.env.PROXY_PROTOCOL),
      providerName: process.env.PROXY_PROVIDER || 'decodo',
      host: process.env.PROXY_HOST || '',
      port: process.env.PROXY_PORT || '',
      ports: parseProxyPorts(process.env.PROXY_PORTS, process.env.PROXY_PORT),
      username: process.env.PROXY_USERNAME || '',
      password: process.env.PROXY_PASSWORD || '',
      backconnectHost: process.env.PROXY_BACKCONNECT_HOST || '',
      backconnectPort: parseInt(process.env.PROXY_BACKCONNECT_PORT || '7000', 10),
      country: process.env.PROXY_COUNTRY || '',
      state: process.env.PROXY_STATE || '',
      city: process.env.PROXY_CITY || '',
      zip: process.env.PROXY_ZIP || '',
      sessionDurationMinutes: parseInt(process.env.PROXY_SESSION_DURATION_MINUTES || '10', 10),
    },
    pluginEnv: {
      ENABLE_VNC: process.env.ENABLE_VNC,
    },
    // Env vars forwarded to the server subprocess
    serverEnv: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: process.env.NODE_ENV,
      SCRAPER_BIND_HOST: getEnv('BIND_HOST', process.env),
      CAMOFOX_BIND_HOST: getEnv('BIND_HOST', process.env),
      SCRAPER_ADMIN_KEY: getEnv('ADMIN_KEY', process.env),
      CAMOFOX_ADMIN_KEY: getEnv('ADMIN_KEY', process.env),
      SCRAPER_API_KEY: getEnv('API_KEY', process.env),
      CAMOFOX_API_KEY: getEnv('API_KEY', process.env),
      SCRAPER_ACCESS_KEY: getEnv('ACCESS_KEY', process.env),
      CAMOFOX_ACCESS_KEY: getEnv('ACCESS_KEY', process.env),
      SCRAPER_EVALUATE_MAX_BODY_SIZE: getEnv('EVALUATE_MAX_BODY_SIZE', process.env),
      CAMOFOX_EVALUATE_MAX_BODY_SIZE: getEnv('EVALUATE_MAX_BODY_SIZE', process.env),
      SCRAPER_COOKIES_DIR: getEnv('COOKIES_DIR', process.env),
      CAMOFOX_COOKIES_DIR: getEnv('COOKIES_DIR', process.env),
      SCRAPER_UPLOADS_DIR: getEnv('UPLOADS_DIR', process.env),
      CAMOFOX_UPLOADS_DIR: getEnv('UPLOADS_DIR', process.env),
      SCRAPER_TRACES_DIR: getEnv('TRACES_DIR', process.env),
      CAMOFOX_TRACES_DIR: getEnv('TRACES_DIR', process.env),
      SCRAPER_TRACES_MAX_BYTES: getEnv('TRACES_MAX_BYTES', process.env),
      CAMOFOX_TRACES_MAX_BYTES: getEnv('TRACES_MAX_BYTES', process.env),
      SCRAPER_TRACES_TTL_HOURS: getEnv('TRACES_TTL_HOURS', process.env),
      CAMOFOX_TRACES_TTL_HOURS: getEnv('TRACES_TTL_HOURS', process.env),
      SCRAPER_DISABLE_DEFAULT_ADDONS: getEnv('DISABLE_DEFAULT_ADDONS', process.env),
      CAMOFOX_DISABLE_DEFAULT_ADDONS: getEnv('DISABLE_DEFAULT_ADDONS', process.env),
      SCRAPER_INTERACTIVE: getEnv('INTERACTIVE', process.env),
      CAMOFOX_INTERACTIVE: getEnv('INTERACTIVE', process.env),
      SCRAPER_LOCALE: getEnv('LOCALE', process.env),
      CAMOFOX_LOCALE: getEnv('LOCALE', process.env),
      SCRAPER_TIMEZONE: getEnv('TIMEZONE', process.env),
      CAMOFOX_TIMEZONE: getEnv('TIMEZONE', process.env),
      SCRAPER_OS: getEnv('OS', process.env),
      CAMOFOX_OS: getEnv('OS', process.env),
      NAVIGATE_TIMEOUT_MS: process.env.NAVIGATE_TIMEOUT_MS,
      SCRAPER_SHUTDOWN_TIMEOUT_MS: getEnv('SHUTDOWN_TIMEOUT_MS', process.env),
      CAMOFOX_SHUTDOWN_TIMEOUT_MS: getEnv('SHUTDOWN_TIMEOUT_MS', process.env),
      CAMOUFOX_EXECUTABLE: process.env.CAMOUFOX_EXECUTABLE,
      CAMOUFOX_EXECUTABLE_PATH: process.env.CAMOUFOX_EXECUTABLE_PATH,
      SCRAPER_EXECUTABLE_PATH: getEnv('EXECUTABLE_PATH', process.env),
      CAMOFOX_EXECUTABLE_PATH: getEnv('EXECUTABLE_PATH', process.env),
      PROXY_STRATEGY: process.env.PROXY_STRATEGY,
      PROXY_PROTOCOL: process.env.PROXY_PROTOCOL,
      PROXY_PROVIDER: process.env.PROXY_PROVIDER,
      PROXY_HOST: process.env.PROXY_HOST,
      PROXY_PORT: process.env.PROXY_PORT,
      PROXY_PORTS: process.env.PROXY_PORTS,
      PROXY_USERNAME: process.env.PROXY_USERNAME,
      PROXY_PASSWORD: process.env.PROXY_PASSWORD,
      PROXY_BACKCONNECT_HOST: process.env.PROXY_BACKCONNECT_HOST,
      PROXY_BACKCONNECT_PORT: process.env.PROXY_BACKCONNECT_PORT,
      PROXY_COUNTRY: process.env.PROXY_COUNTRY,
      PROXY_STATE: process.env.PROXY_STATE,
      PROXY_CITY: process.env.PROXY_CITY,
      PROXY_ZIP: process.env.PROXY_ZIP,
      PROXY_SESSION_DURATION_MINUTES: process.env.PROXY_SESSION_DURATION_MINUTES,
      ENABLE_VNC: process.env.ENABLE_VNC,
      VNC_RESOLUTION: process.env.VNC_RESOLUTION,
      VNC_PASSWORD: process.env.VNC_PASSWORD,
      VIEW_ONLY: process.env.VIEW_ONLY,
      VNC_PORT: process.env.VNC_PORT,
      NOVNC_PORT: process.env.NOVNC_PORT,
      VNC_BIND: process.env.VNC_BIND,
      VNC_RFB_BIND: process.env.VNC_RFB_BIND,
    },
    // Crash reporter (opt-in, reports sent to Cloudflare Worker relay)
    crashReportEnabled: getEnv('CRASH_REPORT_ENABLED', process.env) !== 'false',
    crashReportUrl: getEnv('CRASH_REPORT_URL', process.env),
    crashReportRepo: getEnv('CRASH_REPORT_REPO', process.env),
    crashReportRateLimit: parseInt(getEnv('CRASH_REPORT_RATE_LIMIT', process.env, '10'), 10) || 10,
    crashReporterConfig: readCrashReporterConfig(),
    sentryDsn: process.env.SENTRY_DSN || '',
  };
}

function windowsProcessEnvironment() {
  const env = {};
  for (const key of ['COMSPEC', 'ComSpec', 'SystemRoot', 'SystemDrive', 'WINDIR', 'Path', 'PATHEXT', 'TEMP', 'TMP', 'PSModulePath']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}

export { loadConfig, readCamofoxConfig, directBrowserIdentity, windowsProcessEnvironment };
