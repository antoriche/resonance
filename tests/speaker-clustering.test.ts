import { readFileSync, readdirSync } from "fs";
import { join, basename, extname } from "path";
import alasql from "alasql";
import {
  DEFAULTS,
  neighborsSQL,
  corePointsSQL,
  coreEdgesSQL,
  borderAssignmentsAlasqlSQL,
  finalSelectAlasqlSQL,
} from "@/lib/db/sql/dbscan";

// ── Load diarized data ──────────────────────────────────────────────

interface DiarizedSegment {
  offset: number;
  duration: number;
  embedding: number[];
}

const DIARIZED_DIR = join(__dirname, "files", "diarized");

function loadDiarizedFile(filename: string): DiarizedSegment[] {
  return JSON.parse(readFileSync(join(DIARIZED_DIR, filename), "utf-8"));
}

// ── Cosine distance (mirrors pgvector's <=>) ────────────────────────

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 1 : 1 - dot / denom;
}

// ── DBSCAN via alasql ───────────────────────────────────────────────
// Each step mirrors a CTE from computed_speakers. SQL fragments come
// from @/lib/db/sql/dbscan (same source as the PostgreSQL view).
// `.sql` gives `?`-placeholder syntax that alasql understands.

const TABLE = DEFAULTS.table;

function runDbscanSql(
  segments: Array<{ id: string; embedding: number[] }>,
): Map<string, string | null> {
  (alasql.fn as Record<string, unknown>).cosine_distance = cosineDistance;

  // Seed table
  alasql(`CREATE TABLE IF NOT EXISTS ${TABLE} (id STRING, embedding JSON)`);
  alasql(`DELETE FROM ${TABLE}`);
  for (const seg of segments) {
    alasql(`INSERT INTO ${TABLE} VALUES (?, ?)`, [seg.id, seg.embedding]);
  }

  // Step 1: neighbors
  alasql(
    "CREATE TABLE IF NOT EXISTS neighbors (id STRING, neighbor_id STRING)",
  );
  alasql("DELETE FROM neighbors");
  alasql(
    `INSERT INTO neighbors ${neighborsSQL(TABLE, DEFAULTS.alasqlDistance).sql}`,
  );

  // Step 2: core points
  alasql("CREATE TABLE IF NOT EXISTS core_points (id STRING)");
  alasql("DELETE FROM core_points");
  alasql(`INSERT INTO core_points ${corePointsSQL().sql}`);

  // Step 3: core edges
  alasql(
    "CREATE TABLE IF NOT EXISTS core_edges (id STRING, neighbor_id STRING)",
  );
  alasql("DELETE FROM core_edges");
  alasql(`INSERT INTO core_edges ${coreEdgesSQL().sql}`);

  // Step 4: cluster propagation (JS union-find — mirrors the recursive CTE)
  const coreIds = (
    alasql("SELECT id FROM core_points") as Array<{ id: string }>
  ).map((r) => r.id);

  const coreEdgeRows = alasql(
    "SELECT id, neighbor_id FROM core_edges",
  ) as Array<{ id: string; neighbor_id: string }>;

  const parent = new Map<string, string>();
  for (const id of coreIds) parent.set(id, id);

  function find(x: string): string {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  }
  function union(a: string, b: string) {
    const ra = find(a),
      rb = find(b);
    if (ra !== rb) {
      if (ra < rb) parent.set(rb, ra);
      else parent.set(ra, rb);
    }
  }

  for (const edge of coreEdgeRows) union(edge.id, edge.neighbor_id);

  // Write core_resolved
  alasql(
    "CREATE TABLE IF NOT EXISTS core_resolved (id STRING, speaker_id STRING)",
  );
  alasql("DELETE FROM core_resolved");
  for (const id of coreIds) {
    alasql("INSERT INTO core_resolved VALUES (?, ?)", [id, find(id)]);
  }

  // Step 5: border assignments (shared SQL, alasql variant)
  alasql(
    "CREATE TABLE IF NOT EXISTS border_assignments (id STRING, speaker_id STRING)",
  );
  alasql("DELETE FROM border_assignments");
  alasql(`INSERT INTO border_assignments ${borderAssignmentsAlasqlSQL().sql}`);

  // Final SELECT (shared SQL, alasql variant)
  const rows = alasql(finalSelectAlasqlSQL(TABLE).sql) as Array<{
    transcription_id: string;
    speaker_id: string | null;
  }>;

  // Cleanup
  for (const t of [
    TABLE,
    "neighbors",
    "core_points",
    "core_edges",
    "core_resolved",
    "border_assignments",
  ]) {
    alasql(`DROP TABLE ${t}`);
  }

  return new Map(rows.map((r) => [r.transcription_id, r.speaker_id]));
}

// ── Helpers ──────────────────────────────────────────────────────────

function countSpeakers(
  ids: string[],
  results: Map<string, string | null>,
): number {
  let count = 0;
  const seen = new Set<string>();
  for (const id of ids) {
    const speaker = results.get(id);
    if (speaker === null || speaker === undefined) {
      count++;
    } else if (!seen.has(speaker)) {
      seen.add(speaker);
      count++;
    }
  }
  return count;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("Speaker clustering (computed_speakers SQL via alasql)", () => {
  const fileMap = new Map<string, string[]>();
  let results: Map<string, string | null>;

  beforeAll(() => {
    const jsonFiles = readdirSync(DIARIZED_DIR)
      .filter((f) => extname(f) === ".json")
      .sort();

    const allSegments: Array<{ id: string; embedding: number[] }> = [];

    for (const file of jsonFiles) {
      const data = loadDiarizedFile(file);
      const fileName = basename(file, ".json");
      const ids: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const id = `${fileName}__${i}`;
        ids.push(id);
        allSegments.push({ id, embedding: data[i].embedding });
      }

      fileMap.set(fileName, ids);
    }

    results = runDbscanSql(allSegments);

    // Debug
    for (const [file, ids] of fileMap) {
      const n = countSpeakers(ids, results);
      const speakers = [...new Set(ids.map((id) => results.get(id)))];
      console.log(
        `  ${file}: ${ids.length} segments → ${n} speaker(s) [${speakers.join(", ")}]`,
      );
    }
  });

  const expected: Record<string, number> = {
    "Enregistrement 1": 2,
    "Enregistrement 2": 2,
    "Enregistrement 3": 1,
    "Enregistrement 4": 1,
    "Enregistrement 5": 1,
    "Enregistrement 6": 1,
  };

  it.each(Object.entries(expected))(
    "%s should have %i speaker(s)",
    (file: string, expectedSpeakers: number) => {
      const ids = fileMap.get(file);
      expect(ids).toBeDefined();
      const count = countSpeakers(ids!, results);
      expect(count).toBe(expectedSpeakers);
    },
  );
});
