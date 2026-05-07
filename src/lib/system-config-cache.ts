import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SystemConfig } from '@/types/database';

let cacheReady = false;
let loadPromise: Promise<void> | null = null;

let globalRow: SystemConfig | null = null;
const classRows = new Map<number, SystemConfig>();

async function fetchAllIntoCache(): Promise<void> {
  const client = await getSupabaseClient();
  const { data, error } = await client.from('system_configs').select('*');
  if (error) throw new Error(`加载系统配置缓存失败: ${error.message}`);

  let nextGlobal: SystemConfig | null = null;
  const nextClass = new Map<number, SystemConfig>();
  for (const row of data ?? []) {
    const r = row as SystemConfig;
    if (r.class_id == null) {
      nextGlobal = r;
    } else {
      nextClass.set(r.class_id, r);
    }
  }
  globalRow = nextGlobal;
  classRows.clear();
  for (const [k, v] of nextClass) {
    classRows.set(k, v);
  }
  cacheReady = true;
}

/** 首次请求或缓存未就绪时加载；并发只触发一次查询 */
export async function ensureSystemConfigCache(): Promise<void> {
  if (cacheReady) return;
  if (!loadPromise) {
    loadPromise = fetchAllIntoCache().finally(() => {
      loadPromise = null;
    });
  }
  await loadPromise;
}

/** 与数据库同步：创建/更新配置后调用，或服务启动预热线 */
export async function refreshSystemConfigCache(): Promise<void> {
  await fetchAllIntoCache();
}

export function getResolvedSystemConfig(classId?: number): SystemConfig | null {
  if (!cacheReady) return null;
  if (!classId) return globalRow;
  return classRows.get(classId) ?? globalRow;
}

/** 写入失败或需强制下次从数据库重载时调用 */
export function invalidateSystemConfigCache(): void {
  cacheReady = false;
}
