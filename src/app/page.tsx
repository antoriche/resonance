"use client";

import styles from "./root.module.css";
import ChatPanel from "@/components/ChatPanel/ChatPanel";
import ControlBar from "@/components/ControlBar/ControlBar";
import {
  useInfiniteTranscriptions,
  useNewerTranscriptions,
  type TranscriptionsResponse,
} from "@/hooks/transcriptions";
import { useMemo, useState, useEffect } from "react";
import { queryClient } from "./providers";
import type { TranscriptionListItem } from "@/types/api";
import BottomNav, { type Tab } from "@/components/BottomNav/BottomNav";
import AIView from "@/components/views/AIView";
import RecordView from "@/components/views/RecordView";
import SettingsView from "@/components/views/SettingsView";

export default function Home() {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("record");

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

  // Right panel visible on desktop always; on mobile only for non-transcriptions tabs
  const rightPanelClass = [
    styles.card,
    styles.rightPanel,
    activeTab !== "transcriptions" ? styles.rightPanelMobileVisible : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (error) {
    return (
      <>
        <header className={styles.header}>
          <h1 className={styles.title}>Notetaker</h1>
        </header>
        <main className={styles.main}>
          <div className={styles.panels}>
            <section className={`${styles.card} ${styles.mainPanel}`}>
              <div style={{ padding: "2rem", color: "red" }}>
                Error loading transcriptions: {error.message}
              </div>
            </section>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Notetaker</h1>
      </header>
      <main className={styles.main}>
        <div className={styles.panels}>
          {/* ── Left / main panel: transcription list ────────────────
              Hidden on mobile when a non-record tab is active.          */}
          <section
            className={[
              styles.card,
              styles.mainPanel,
              activeTab !== "transcriptions" ? styles.mainPanelHideMobile : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
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

          {/* ── Right panel: active view + BottomNav (desktop) ────────
              On desktop it sits right of the main panel.
              On mobile it becomes full-screen for AI / Settings tabs.   */}
          <section className={rightPanelClass}>
            <div className={styles.rightPanelInner}>
              {activeTab === "ai" && <AIView />}
              {activeTab === "record" && <RecordView />}
              {activeTab === "settings" && <SettingsView />}
            </div>
            {/* Desktop-only nav – hidden on mobile via CSS */}
            <div className={styles.desktopNav}>
              <BottomNav activeTab={activeTab} onChange={setActiveTab} />
            </div>
          </section>
        </div>

        {/* ── Persistent ControlBar: flow card on desktop, fixed on mobile ── */}
        <div className={`${styles.card} ${styles.controlBarWrapper}`}>
          <ControlBar />
        </div>
      </main>

      {/* ── Mobile-only fixed footer nav – hidden on desktop via CSS ── */}
      <div className={styles.mobileNav}>
        <BottomNav activeTab={activeTab} onChange={setActiveTab} />
      </div>
    </>
  );
}
