import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { transcriptions, files } from '../src/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkFileIds() {
  await client.connect();
  const db = drizzle(client);

  const lastThree = await db
    .select({
      id: transcriptions.id,
      fileId: transcriptions.fileId,
      offset: transcriptions.offset,
      duration: transcriptions.duration,
      text: transcriptions.text,
      recordingTimestamp: files.recordingTimestamp,
    })
    .from(transcriptions)
    .innerJoin(files, sql`${transcriptions.fileId} = ${files.id}`)
    .orderBy(desc(sql`${files.recordingTimestamp} + (${transcriptions.offset} || ' milliseconds')::interval`))
    .limit(3);

  console.log('Last 3 transcriptions (sorted by actual time):');
  lastThree.forEach((t, idx) => {
    const actualTime = new Date(t.recordingTimestamp.getTime() + t.offset);
    console.log(`\n[${idx}] ID: ${t.id}`);
    console.log(`    File ID: ${t.fileId}`);
    console.log(`    Recording time: ${t.recordingTimestamp.toISOString()}`);
    console.log(`    Offset: ${t.offset}ms, Duration: ${t.duration}ms`);
    console.log(`    Actual timestamp: ${actualTime.toISOString()}`);
    console.log(`    Text: ${t.text.substring(0, 80)}`);
  });

  const sameFile = lastThree[0].fileId === lastThree[2].fileId;
  console.log(`\n\nAre last and last-2 from same file? ${sameFile ? 'YES' : 'NO'}`);

  await client.end();
}

checkFileIds().catch(console.error);
