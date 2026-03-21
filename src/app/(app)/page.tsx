"use client";

import NotesPanel from "@/components/NotesPanel/NotesPanel";
import AIView from "@/components/views/AIView";
import styles from "./page.module.css";

/**
 * Home page ("/")
 *
 * Desktop: NotesPanel is already in the layout's left panel,
 *          so we render AIView in the right panel.
 * Mobile:  NotesPanel is hidden in the layout, so we render it here.
 *          ControlBar card is handled by the layout (below this card).
 *          AIView is hidden on mobile (accessible via /ai).
 */
export default function HomePage() {
  return (
    <>
      {/* Mobile-only: full-screen notes */}
      <div className={styles.mobileOnly}>
        <NotesPanel />
      </div>
      {/* Desktop-only: AI in the right panel (notes are in the layout) */}
      <div className={styles.desktopOnly}>
        <AIView />
      </div>
    </>
  );
}
