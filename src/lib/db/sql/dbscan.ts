/**
 * DBSCAN SQL fragments shared between the computed_speakers view (PostgreSQL)
 * and the test suite (alasql).
 *
 * Uses `sql-template-tag` for composable, type-safe SQL.
 * - `raw()` for identifiers (table names, expressions)
 * - `Sql` instances compose automatically via nesting
 *
 * Each step corresponds to a CTE in the computed_speakers view.
 */

import sql, { raw, type Sql } from "sql-template-tag";

// ── Defaults ─────────────────────────────────────────────────────────

export const DEFAULTS = {
  table: "transcriptions",
  /** pgvector cosine distance operator */
  pgDistance: "(a.embedding <=> b.embedding)",
  /** alasql UDF equivalent */
  alasqlDistance: "cosine_distance(a.embedding, b.embedding)",
  eps: 0.35,
  minPts: 1,
} as const;

// ── Step 1: neighbor pairs within eps ────────────────────────────────

export const neighborsSQL = (
  table: string = DEFAULTS.table,
  distanceExpr: string = DEFAULTS.pgDistance,
  eps: number = DEFAULTS.eps,
) => sql`
  SELECT
    a.id AS id,
    b.id AS neighbor_id
  FROM ${raw(table)} a
  JOIN ${raw(table)} b
    ON a.id <> b.id
    AND ${raw(distanceExpr)} < ${raw(String(eps))}
`;

// ── Step 2: core points (>= minPts neighbors) ───────────────────────

export const corePointsSQL = (minPts: number = DEFAULTS.minPts) => sql`
  SELECT id
  FROM (
    SELECT id, COUNT(*) AS cnt
    FROM neighbors
    GROUP BY id
  ) sub
  WHERE cnt >= ${raw(String(minPts))}
`;

// ── Step 3: edges between core points only ───────────────────────────

export const coreEdgesSQL = () => sql`
  SELECT n.id, n.neighbor_id
  FROM neighbors n
  JOIN core_points cp1 ON cp1.id = n.id
  JOIN core_points cp2 ON cp2.id = n.neighbor_id
`;

// ── Step 4: cluster propagation (PostgreSQL recursive CTE) ──────────
// alasql tests use JS union-find instead.

export const clustersSeedSQL = () => sql`
  SELECT
    cp.id,
    LEAST(cp.id, COALESCE(MIN(ce.neighbor_id), cp.id)) AS speaker_id
  FROM core_points cp
  LEFT JOIN core_edges ce ON ce.id = cp.id
  GROUP BY cp.id
`;

export const clustersRecursiveSQL = () => sql`
  SELECT
    ce.id,
    LEAST(c.speaker_id, ce.neighbor_id)
  FROM clusters c
  JOIN core_edges ce ON ce.neighbor_id = c.id
  WHERE c.speaker_id < ce.id
`;

export const coreResolvedSQL = () => sql`
  SELECT id, MIN(speaker_id) AS speaker_id
  FROM clusters
  GROUP BY id
`;

// ── Step 5: border point assignments ─────────────────────────────────

/** PostgreSQL version using DISTINCT ON */
export const borderAssignmentsSQL = () => sql`
  SELECT DISTINCT ON (n.id)
    n.id,
    cr.speaker_id
  FROM neighbors n
  JOIN core_resolved cr ON cr.id = n.neighbor_id
  WHERE n.id NOT IN (SELECT id FROM core_points)
  ORDER BY n.id
`;

/** alasql version (no DISTINCT ON → GROUP BY + MIN) */
export const borderAssignmentsAlasqlSQL = () => sql`
  SELECT n.id, MIN(cr.speaker_id) AS speaker_id
  FROM neighbors n
  JOIN core_resolved cr ON cr.id = n.neighbor_id
  WHERE n.id NOT IN (SELECT id FROM core_points)
  GROUP BY n.id
`;

// ── Final: union core + border, noise = NULL ─────────────────────────

/** PostgreSQL version */
export const finalSelectSQL = (table: string = DEFAULTS.table) => sql`
  SELECT
    t.id AS transcription_id,
    COALESCE(cr.speaker_id, ba.speaker_id) AS speaker_id
  FROM ${raw(table)} t
  LEFT JOIN core_resolved cr ON cr.id = t.id
  LEFT JOIN border_assignments ba ON ba.id = t.id
`;

/** alasql version (COALESCE → CASE) */
export const finalSelectAlasqlSQL = (table: string = DEFAULTS.table) => sql`
  SELECT
    t.id AS transcription_id,
    CASE
      WHEN cr.speaker_id IS NOT NULL THEN cr.speaker_id
      WHEN ba.speaker_id IS NOT NULL THEN ba.speaker_id
      ELSE NULL
    END AS speaker_id
  FROM ${raw(table)} t
  LEFT JOIN core_resolved cr ON cr.id = t.id
  LEFT JOIN border_assignments ba ON ba.id = t.id
`;

// ── Full PostgreSQL WITH RECURSIVE query ─────────────────────────────

export const computedSpeakersSQL = (
  table: string = DEFAULTS.table,
  distanceExpr: string = DEFAULTS.pgDistance,
  eps: number = DEFAULTS.eps,
  minPts: number = DEFAULTS.minPts,
): Sql => sql`
  WITH RECURSIVE

  neighbors AS (${neighborsSQL(table, distanceExpr, eps)}),

  core_points AS (${corePointsSQL(minPts)}),

  core_edges AS (${coreEdgesSQL()}),

  clusters AS (
    ${clustersSeedSQL()}
    UNION
    ${clustersRecursiveSQL()}
  ),

  core_resolved AS (${coreResolvedSQL()}),

  border_assignments AS (${borderAssignmentsSQL()})

  ${finalSelectSQL(table)}
`;
