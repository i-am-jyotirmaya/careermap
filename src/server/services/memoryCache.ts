import crypto from 'node:crypto';
import type { CareerForgeDB } from '../db/database.ts';
import type {
  FlashcardItem,
  MemoryCacheStats,
  PreparedPhaseBlueprint,
  PreparedTopicNode,
  ResourceKind,
} from '../../shared/types.ts';

export function canonicalizeKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeTextForHash(input: string | null | undefined): string {
  return (input ?? '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

export function computeContextHash(parts: Array<string | null | undefined>): string {
  const joined = parts.map((p) => normalizeTextForHash(p)).join('\n|||\n');
  return crypto.createHash('sha256').update(joined, 'utf8').digest('hex');
}

export interface CachedResourceTemplate {
  kind: ResourceKind;
  title: string;
  url: string | null;
  providerOrAuthor: string;
  estimatedMinutes: number;
  difficulty: string;
  whyRelevant: string;
  contentMarkdown: string;
  flashcards: FlashcardItem[];
  xpReward: number;
}

export interface CachedResourcePack {
  canonicalKey: string;
  contextHash: string;
  focusNote: string;
  modelUsed: string | null;
  resources: CachedResourceTemplate[];
  updatedAt: string;
}

export interface CachedRoadmapBlueprint {
  roadmapKey: string;
  roadmapId?: string;
  title: string;
  targetRole: string;
  description: string;
  phases: PreparedPhaseBlueprint[];
  contextHash: string;
  updatedAt: string;
}

export class MemoryCacheService {
  private readonly db: CareerForgeDB;
  private readonly roadmapsByKey = new Map<string, CachedRoadmapBlueprint>();
  private readonly roadmapsById = new Map<string, CachedRoadmapBlueprint>();
  private readonly nodesByCanonicalKey = new Map<string, PreparedTopicNode>();
  private readonly resourcesByCanonicalKey = new Map<string, CachedResourcePack>();

  constructor(db: CareerForgeDB) {
    this.db = db;
    this.hydrateFromSqlite();
  }

  private hydrateFromSqlite(): void {
    const roadmapRows = this.db.listPreparedRoadmapCacheRows();
    for (const r of roadmapRows) {
      this.roadmapsByKey.set(r.roadmapKey, r);
      if (r.roadmapId) {
        this.roadmapsById.set(r.roadmapId, r);
      }
      for (const phase of r.phases) {
        for (const node of phase.topics) {
          this.nodesByCanonicalKey.set(node.canonicalKey, node);
        }
      }
    }

    const nodeRows = this.db.listPreparedNodeCacheRows();
    for (const n of nodeRows) {
      this.nodesByCanonicalKey.set(n.canonicalKey, n);
    }

    const resRows = this.db.listPreparedResourceCacheRows();
    for (const pack of resRows) {
      this.resourcesByCanonicalKey.set(pack.canonicalKey, pack);
    }
  }

  public getStats(): MemoryCacheStats {
    return {
      cachedRoadmaps: this.roadmapsByKey.size,
      cachedTopicNodes: this.nodesByCanonicalKey.size,
      cachedResourcePacks: this.resourcesByCanonicalKey.size,
    };
  }

  public clearAll(): void {
    this.roadmapsByKey.clear();
    this.roadmapsById.clear();
    this.nodesByCanonicalKey.clear();
    this.resourcesByCanonicalKey.clear();
  }

  // ---------------- Roadmap & Topic Node Memory Cache ----------------

  public storeRoadmapBlueprint(blueprint: CachedRoadmapBlueprint): void {
    this.roadmapsByKey.set(blueprint.roadmapKey, blueprint);
    if (blueprint.roadmapId) {
      this.roadmapsById.set(blueprint.roadmapId, blueprint);
    }
    this.db.upsertPreparedRoadmapCacheRow(blueprint);

    for (const phase of blueprint.phases) {
      for (const topic of phase.topics) {
        this.storeTopicNode(topic);
      }
    }
  }

  public getRoadmapBlueprint(params: {
    roadmapId?: string;
    title?: string;
    targetRole?: string;
  }): CachedRoadmapBlueprint | null {
    if (params.roadmapId && this.roadmapsById.has(params.roadmapId)) {
      return this.roadmapsById.get(params.roadmapId)!;
    }
    if (params.title) {
      const key = canonicalizeKey(`${params.title}::${params.targetRole ?? ''}`);
      if (this.roadmapsByKey.has(key)) {
        return this.roadmapsByKey.get(key)!;
      }
      const titleOnly = canonicalizeKey(params.title);
      for (const entry of this.roadmapsByKey.values()) {
        if (canonicalizeKey(entry.title) === titleOnly) {
          return entry;
        }
      }
    }
    return null;
  }

  public storeTopicNode(node: PreparedTopicNode): void {
    this.nodesByCanonicalKey.set(node.canonicalKey, node);
    this.db.upsertPreparedNodeCacheRow(node);
  }

  public getTopicNode(canonicalOrTitle: string): PreparedTopicNode | null {
    const key = canonicalizeKey(canonicalOrTitle);
    return this.nodesByCanonicalKey.get(key) ?? null;
  }

  public listCachedTopicNodes(): PreparedTopicNode[] {
    return [...this.nodesByCanonicalKey.values()];
  }

  // ---------------- Generated Learning Resources Memory Cache ----------------

  public storeResourcePack(pack: CachedResourcePack): void {
    this.resourcesByCanonicalKey.set(pack.canonicalKey, pack);
    this.db.upsertPreparedResourceCacheRow(pack);
  }

  public getResourcePack(canonicalOrTitle: string): CachedResourcePack | null {
    const key = canonicalizeKey(canonicalOrTitle);
    return this.resourcesByCanonicalKey.get(key) ?? null;
  }
}
