export interface WpConfig {
  dbName: string;
  dbUser: string;
  dbPass: string;
}

export interface WpSite {
  url: string;
  title: string;
  adminUser: string;
  adminEmail: string;
}

export interface WpAsset {
  active: boolean;
  version: string;
  updateAvailable: boolean;
}

export interface WpUser {
  email: string;
  role: string;
}

export interface WpState {
  downloaded: boolean;
  config: WpConfig | null;
  dbCreated: boolean;
  installed: boolean;
  site: WpSite | null;
  plugins: Record<string, WpAsset>;
  themes: Record<string, WpAsset>;
  users: Record<string, WpUser>;
  coreUpdateAvailable: boolean;
  coreLanguageUpdateAvailable: boolean;
  dbBackupFile: string | null;
  dbRestoredFrom: string | null;
  cacheDirty: boolean;
  permalinksDirty: boolean;
  lastCommand: string | null;
}

export interface WpCommandResult {
  ok: boolean;
  output: string[];
  state: WpState;
  unlockedCommand?: string;
}

export function createInitialWpState(): WpState {
  return {
    downloaded: false,
    config: null,
    dbCreated: false,
    installed: false,
    site: null,
    plugins: {},
    themes: {},
    users: {},
    coreUpdateAvailable: false,
    coreLanguageUpdateAvailable: false,
    dbBackupFile: null,
    dbRestoredFrom: null,
    cacheDirty: false,
    permalinksDirty: false,
    lastCommand: null,
  };
}
