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

export interface WpState {
  downloaded: boolean;
  config: WpConfig | null;
  dbCreated: boolean;
  installed: boolean;
  site: WpSite | null;
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
    lastCommand: null,
  };
}
