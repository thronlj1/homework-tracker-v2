import { createClient, SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let execSync: any = null;
let envLoaded = false;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
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

  if (!url) throw new Error('Supabase URL is not set');
  if (!anonKey) throw new Error('Supabase anon/publishable key is not set');

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
  const key = token ? anonKey : ((await getSupabaseServiceRoleKey()) ?? anonKey);

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

  const key = token ? anonKey : (getServerSupabaseServiceRoleKey() ?? anonKey);
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
