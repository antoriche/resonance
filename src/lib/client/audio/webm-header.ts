// ── WebM Init Segment Extraction ─────────────────────────────────────
//
// When using MediaRecorder with a timeslice, only the first blob
// contains the full WebM container header (EBML + Segment + Tracks).
// Subsequent blobs are bare Cluster data that FFmpeg cannot parse.
//
// This module extracts the init segment from the first blob so it
// can be prepended to every subsequent blob, making each upload a
// self-contained, valid WebM file.
// ─────────────────────────────────────────────────────────────────────

/** Matroska Cluster element ID: 0x1F43B675 */
const CLUSTER_ID = new Uint8Array([0x1f, 0x43, 0xb6, 0x75]);

/**
 * Find the byte offset of the first Cluster element in a WebM buffer.
 * Returns -1 if not found.
 */
function findClusterOffset(data: Uint8Array): number {
  // Search for the 4-byte Cluster element ID
  for (let i = 0; i <= data.length - 4; i++) {
    if (
      data[i] === CLUSTER_ID[0] &&
      data[i + 1] === CLUSTER_ID[1] &&
      data[i + 2] === CLUSTER_ID[2] &&
      data[i + 3] === CLUSTER_ID[3]
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Extract the init segment (EBML header + Segment + Tracks) from the
 * first WebM blob produced by MediaRecorder.
 *
 * @returns The init segment bytes, or `null` if no Cluster was found
 *          (meaning the blob is too small or not WebM).
 */
export async function extractWebmInitSegment(
  blob: Blob,
): Promise<Uint8Array | null> {
  const buffer = await blob.arrayBuffer();
  const data = new Uint8Array(buffer);

  const clusterOffset = findClusterOffset(data);
  if (clusterOffset <= 0) return null;

  // Everything before the first Cluster is the init segment
  return data.slice(0, clusterOffset);
}

/**
 * Prepend a previously captured init segment to a subsequent chunk blob,
 * producing a new Blob that is a valid standalone WebM file.
 */
export function prependInitSegment(
  initSegment: Uint8Array,
  chunkBlob: Blob,
): Blob {
  return new Blob([initSegment as unknown as ArrayBuffer, chunkBlob], {
    type: chunkBlob.type,
  });
}
