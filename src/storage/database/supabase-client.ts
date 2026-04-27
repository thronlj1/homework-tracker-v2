import { createClient, SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let execSync: any = null;
let envLoaded = false;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

function maskSecret(value?: string): string {
  if (!value) return '(empty)';
  if (value.length <= 8) return `${value[0] ?? ''}***(${value.length})`;
  return `${value.slice(0, 4)}...${value.slice(-4)}(len=${value.length})`;
}

function getUrlSource(isBrowser: boolean): string {
  if (isBrowser) {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) return 'NEXT_PUBLIC_SUPABASE_URL';
    if (getServerSupabaseUrl()) return 'SUPABASE_URL/COZE_SUPABASE_URL';
    return 'none';
  }
  if (getServerSupabaseUrl()) return 'SUPABASE_URL/COZE_SUPABASE_URL';
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return 'NEXT_PUBLIC_SUPABASE_URL';
  return 'none';
}

function getKeySource(isBrowser: boolean): string {
  if (isBrowser) {
    if (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY';
    if (getServerSupabaseAnonKey()) return 'SUPABASE_ANON_KEY/COZE_SUPABASE_ANON_KEY';
    return 'none';
  }
  if (getServerSupabaseAnonKey()) return 'SUPABASE_ANON_KEY/COZE_SUPABASE_ANON_KEY';
  if (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY';
  return 'none';
}

function logSupabaseEnvDiagnostics(isBrowser: boolean, url?: string, anonKey?: string): void {
  if (isBrowser) return;
  const serviceRoleKey = getServerSupabaseServiceRoleKey();
  console.error(
    '[supabase-env] diagnostics',
    JSON.stringify({
      urlSource: getUrlSource(isBrowser),
      keySource: getKeySource(isBrowser),
      urlMasked: maskSecret(url),
      keyMasked: maskSecret(anonKey),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      useServiceRole: shouldUseServiceRoleKey(),
      serviceRoleMasked: maskSecret(serviceRoleKey),
    })
  );
}

function getServerSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL ?? process.env.COZE_SUPABASE_URL;
}

function getServerSupabaseAnonKey(): string | undefined {
  return process.env.SUPABASE_ANON_KEY ?? process.env.COZE_SUPABASE_ANON_KEY;
}

function getServerSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
}

function shouldUseServiceRoleKey(): boolean {
  return process.env.SUPABASE_USE_SERVICE_ROLE === '1';
}

async function loadEnv(): Promise<void> {
  if (envLoaded || (getServerSupabaseUrl() && getServerSupabaseAnonKey())) {
    return;
  }

  const isNode = typeof window === 'undefined' && typeof process !== 'undefined';
  if (!isNode) return;

  try {
    try {
      const dotenv = await import('dotenv');
      dotenv.config();
      if (getServerSupabaseUrl() && getServerSupabaseAnonKey()) {
        envLoaded = true;
        return;
      }
    } catch {
      // dotenv not available
    }

    if (!execSync) {
      const childProcess = await import('child_process');
      execSync = childProcess.execSync;
    }

    const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`;

    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex);
        let value = line.substring(eqIndex + 1);
        if (
          (value.startsWith("'") && value.endsWith("'")) ||
          (value.startsWith('"') && value.endsWith('"'))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }

    envLoaded = true;
  } catch {
    // silently fail
  }
}

async function getSupabaseCredentials(): Promise<SupabaseCredentials> {
  await loadEnv();
  const isBrowser = typeof window !== 'undefined';

  const url = isBrowser
    ? (process.env.NEXT_PUBLIC_SUPABASE_URL ?? getServerSupabaseUrl())
    : (getServerSupabaseUrl() ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = isBrowser
    ? (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? getServerSupabaseAnonKey())
    : (getServerSupabaseAnonKey() ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (!url) {
    logSupabaseEnvDiagnostics(isBrowser, url, anonKey);
    throw new Error('Supabase URL is not set');
  }
  if (!anonKey) {
    logSupabaseEnvDiagnostics(isBrowser, url, anonKey);
    throw new Error('Supabase anon/publishable key is not set');
  }

  if (!isBrowser && process.env.SUPABASE_DEBUG_ENV === '1') {
    logSupabaseEnvDiagnostics(isBrowser, url, anonKey);
  }

  return { url, anonKey };
}

async function getSupabaseServiceRoleKey(): Promise<string | undefined> {
  await loadEnv();
  return getServerSupabaseServiceRoleKey();
}

let cachedClient: SupabaseClient | null = null;

export async function getSupabaseClient(token?: string): Promise<SupabaseClient> {
  if (!token && cachedClient) {
    return cachedClient;
  }

  const { url, anonKey } = await getSupabaseCredentials();
  let key = anonKey;
  if (!token && shouldUseServiceRoleKey()) {
    key = (await getSupabaseServiceRoleKey()) ?? anonKey;
  }

  if (token) {
    return createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      db: { timeout: 60000 },
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  const client = createClient(url, key, {
    db: { timeout: 60000 },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  cachedClient = client;
  return client;
}

export function getSupabaseClientSync(token?: string): SupabaseClient {
  const url = getServerSupabaseUrl();
  const anonKey = getServerSupabaseAnonKey();
  if (!url || !anonKey) {
    throw new Error('Supabase credentials not available');
  }

  let key = anonKey;
  if (!token && shouldUseServiceRoleKey()) {
    key = getServerSupabaseServiceRoleKey() ?? anonKey;
  }
  if (token) {
    return createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      db: { timeout: 60000 },
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return createClient(url, key, {
    db: { timeout: 60000 },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getServiceRoleKey(): Promise<string | undefined> {
  await loadEnv();
  return getServerSupabaseServiceRoleKey();
}

export { loadEnv, getSupabaseCredentials, getSupabaseServiceRoleKey };
