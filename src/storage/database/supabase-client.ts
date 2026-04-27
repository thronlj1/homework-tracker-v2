import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 客户端实例缓存
let cachedClient: SupabaseClient | null = null;

// 获取环境变量（浏览器和服务端通用）
function getEnv(key: string): string | undefined {
  // 客户端从 window.__ENV__ 读取（Next.js 内联）
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__ENV__) {
    return ((window as unknown as Record<string, unknown>).__ENV__ as Record<string, string>)[key];
  }
  // 服务端从 process.env 读取
  return process.env[key];
}

// 创建 Supabase 客户端
export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (cachedClient) {
    return cachedClient;
  }

  // 读取环境变量 - 优先使用 NEXT_PUBLIC_*
  const url = 
    getEnv('NEXT_PUBLIC_SUPABASE_URL') ||
    getEnv('SUPABASE_URL') ||
    getEnv('COZE_SUPABASE_URL');
  
  const key = 
    getEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
    getEnv('SUPABASE_ANON_KEY') ||
    getEnv('COZE_SUPABASE_ANON_KEY');

  if (!url) {
    console.error('可用环境变量:', Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('URL')));
    throw new Error('Supabase URL is not set. 请配置 NEXT_PUBLIC_SUPABASE_URL 环境变量');
  }
  
  if (!key) {
    console.error('可用环境变量:', Object.keys(process.env).filter(k => k.includes('KEY') || k.includes('ANON')));
    throw new Error('Supabase key is not set. 请配置 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 环境变量');
  }

  const client = createClient(url, key, {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  cachedClient = client;
  return client;
}

// 保留同步版本（服务端使用）
export function getSupabaseClientSync(): SupabaseClient {
  const url = 
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.COZE_SUPABASE_URL;
  
  const key = 
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.COZE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(url, key, {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// 获取服务端密钥（仅服务端使用）
export async function getServiceRoleKey(): Promise<string | undefined> {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
}
