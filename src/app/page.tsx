"use client";

import ControlBar from "@/components/ControlBar/ControlBar";
import styles from "./root.module.css";
import ChatPanel from "@/components/ChatPanel/ChatPanel";
import {
  useInfiniteTranscriptions,
  useNewerTranscriptions,
  type TranscriptionsResponse,
} from "@/hooks/transcriptions";
import { useMemo, useState, useEffect } from "react";
import { queryClient } from "./providers";
import type { TranscriptionListItem } from "@/types/api";

export default function Home() {
  const [isAtBottom, setIsAtBottom] = useState(true);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTranscriptions();

  // Get the latest timestamp from current messages for polling
  const latestTimestamp = useMemo(() => {
    if (!data?.pages?.[0]?.data?.[0]) return undefined;

    // First page, first item is the most recent (DESC ordering)
    const latestTranscription = data.pages[0].data[0];
    return new Date(
      new Date(latestTranscription.recordingTimestamp).getTime() +
        latestTranscription.offset,
    );
  }, [data]);

  // Poll for newer transcriptions when at bottom
  const { data: newerData } = useNewerTranscriptions(
    isAtBottom,
    latestTimestamp,
  );

  // Merge newer transcriptions into the infinite query cache
  useEffect(() => {
    if (!newerData?.data || newerData.data.length === 0) return;

    queryClient.setQueryData(
      ["transcriptions", "infinite", undefined],
      (oldData: any) => {
        if (!oldData?.pages) return oldData;

        // Get existing transcriptions from first page
        const existingIds = new Set(
          oldData.pages[0].data.map(
            (item: TranscriptionListItem) => `${item.fileId}-${item.offset}`,
          ),
        );

        // Filter out duplicates from newer data
        const newTranscriptions = newerData.data.filter(
          (item) => !existingIds.has(`${item.fileId}-${item.offset}`),
        );

        if (newTranscriptions.length === 0) return oldData;

        // Prepend new transcriptions to the first page
        return {
          ...oldData,
          pages: [
            {
              ...oldData.pages[0],
              data: [...newTranscriptions, ...oldData.pages[0].data],
            },
            ...oldData.pages.slice(1),
          ],
        };
      },
    );
  }, [newerData]);

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
          id: transcription.speakerId ?? transcription.fileId,
          name: transcription.speakerName ?? undefined,
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
              onScrollPositionChange={setIsAtBottom}
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
