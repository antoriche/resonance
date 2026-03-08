"use client";

import ControlBar from "@/components/ControlBar/ControlBar";
import styles from "./root.module.css";
import ChatPanel from "@/components/ChatPanel/ChatPanel";
import {
  useInfiniteTranscriptions,
  type TranscriptionsResponse,
} from "@/hooks/transcriptions";
import { useMemo } from "react";

export default function Home() {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTranscriptions();

  const messages = useMemo(() => {
    if (!data?.pages) return [];

    // Flatten all pages into a single array
    const allTranscriptions = data.pages.flatMap(
      (page: TranscriptionsResponse) => page.data,
    );

    return allTranscriptions.map((transcription) => {
      // Calculate the actual datetime by adding offset to recording timestamp
      const datetime = new Date(
        new Date(transcription.recordingTimestamp).getTime() +
          transcription.offset,
      );

      return {
        datetime,
        speaker: {
          id: transcription.fileId, // Use fileId as speaker for now
          name: undefined,
          color: undefined,
          gender: "other" as const,
        },
        text: transcription.text,
      };
    });
  }, [data]);

  if (error) {
    return (
      <main className={styles.main}>
        <div className={styles.panels}>
          <section className={`${styles.card} ${styles.mainPanel}`}>
            <div style={{ padding: "2rem", color: "red" }}>
              Error loading transcriptions: {error.message}
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.panels}>
        <section className={`${styles.card} ${styles.leftPanel}`}>A</section>
        <section className={`${styles.card} ${styles.mainPanel}`}>
          {isLoading ? (
            <div style={{ padding: "2rem" }}>Loading transcriptions...</div>
          ) : (
            <ChatPanel
              messages={messages}
              onLoadMore={fetchNextPage}
              hasMore={hasNextPage}
              isLoadingMore={isFetchingNextPage}
            />
          )}
        </section>
        <section className={`${styles.card} ${styles.rightPanel}`}>C</section>
      </div>
      <section className={`${styles.card} ${styles.bottomPanel}`}>
        <ControlBar />
      </section>
    </main>
  );
}
