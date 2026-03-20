import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { transcriptions, files } from '../src/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function compareEmbeddings() {
  await client.connect();
  const db = drizzle(client);

  // Get last 3 transcriptions (sorted by actual chronological time)
  const lastThree = await db
    .select({
      id: transcriptions.id,
      embedding: transcriptions.embedding,
      fileId: transcriptions.fileId,
    })
    .from(transcriptions)
    .innerJoin(files, sql`${transcriptions.fileId} = ${files.id}`)
    .orderBy(desc(sql`${files.recordingTimestamp} + (${transcriptions.offset} || ' milliseconds')::interval`))
    .limit(3);

  if (lastThree.length < 3) {
    console.log(`Only ${lastThree.length} transcriptions found`);
    await client.end();
    return;
  }

  const last = lastThree[0];
  const lastMinus2 = lastThree[2];

  console.log(`Last transcription: ${last.id}`);
  console.log(`  File: ${last.fileId}`);
  console.log(`Last - 2 transcription: ${lastMinus2.id}`);
  console.log(`  File: ${lastMinus2.fileId}`);
  console.log(`Same file? ${last.fileId === lastMinus2.fileId ? 'YES' : 'NO'}`);
  console.log(`Last embedding (first 10 values): ${JSON.stringify(last.embedding.slice(0, 10))}`);
  console.log(`Last - 2 embedding (first 10 values): ${JSON.stringify(lastMinus2.embedding.slice(0, 10))}`);

  // Compare if they're identical
  const areIdentical = JSON.stringify(last.embedding) === JSON.stringify(lastMinus2.embedding);
  console.log(`Are they identical? ${areIdentical ? 'YES' : 'NO'}`);

  if (!areIdentical) {
    // Calculate cosine similarity
    const dotProduct = last.embedding.reduce((sum: number, val: number, idx: number) => 
      sum + val * lastMinus2.embedding[idx], 0);
    
    const magnitudeA = Math.sqrt(last.embedding.reduce((sum: number, val: number) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(lastMinus2.embedding.reduce((sum: number, val: number) => sum + val * val, 0));
    
    const cosineSimilarity = dotProduct / (magnitudeA * magnitudeB);
    console.log(`Cosine similarity: ${cosineSimilarity.toFixed(6)}`);
  }

  await client.end();
}

compareEmbeddings().catch(console.error);
