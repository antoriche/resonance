"use client";

import { useMemo, useState, useEffect } from "react";
import { queryClient } from "@/app/providers";
import {
  useInfiniteTranscriptions,
  useNewerTranscriptions,
  type TranscriptionsResponse,
} from "@/hooks/transcriptions";
import type { TranscriptionListItem } from "@/types/api";
import ChatPanel from "@/components/ChatPanel/ChatPanel";

/**
 * Data-fetching & transformation layer around ChatPanel.
 *
 * - Owns infinite-scroll pagination
 * - Polls for newer transcriptions and merges them into cache
 * - Transforms `TranscriptionListItem[]` → ChatPanel's message shape
 */
export default function NotesPanel() {
  const [isAtBottom, setIsAtBottom] = useState(true);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTranscriptions();

  // Latest timestamp for polling newer transcriptions
  const latestTimestamp = useMemo(() => {
    if (!data?.pages?.[0]?.data?.[0]) return undefined;
    const latest = data.pages[0].data[0];
    return new Date(
      new Date(latest.recordingTimestamp).getTime() + latest.offset,
    );
  }, [data]);

  // Poll for newer transcriptions when user is at the bottom
  const { data: newerData } = useNewerTranscriptions(
    isAtBottom,
    latestTimestamp,
  );

  // Merge newer transcriptions into infinite query cache
  useEffect(() => {
    if (!newerData?.data || newerData.data.length === 0) return;

    queryClient.setQueryData(
      ["transcriptions", "infinite", undefined],
      (oldData: any) => {
        if (!oldData?.pages) return oldData;

        const existingIds = new Set(
          oldData.pages[0].data.map(
            (item: TranscriptionListItem) => `${item.fileId}-${item.offset}`,
          ),
        );

        const newTranscriptions = newerData.data.filter(
          (item) => !existingIds.has(`${item.fileId}-${item.offset}`),
        );

        if (newTranscriptions.length === 0) return oldData;

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

  // Transform TranscriptionListItem[] → ChatPanel message shape
  const messages = useMemo(() => {
    if (!data?.pages) return [];

    const allTranscriptions = data.pages.flatMap(
      (page: TranscriptionsResponse) => page.data,
    );

    return allTranscriptions.map((transcription) => {
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
      <div style={{ padding: "2rem", color: "red" }}>
        Error loading transcriptions: {error.message}
      </div>
    );
  }

  if (isLoading) {
    return <div style={{ padding: "2rem" }}>Loading transcriptions...</div>;
  }

  return (
    <ChatPanel
      messages={messages}
      onLoadMore={fetchNextPage}
      hasMore={hasNextPage}
      isLoadingMore={isFetchingNextPage}
      onScrollPositionChange={setIsAtBottom}
    />
  );
}
