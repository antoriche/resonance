"use client";

import { usePathname } from "next/navigation";
import styles from "./layout.module.css";
import NotesPanel from "@/components/NotesPanel/NotesPanel";
import ControlBar from "@/components/ControlBar/ControlBar";
import BottomNav from "@/components/BottomNav/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Notetaker</h1>
      </header>

      <main className={styles.main}>
        <div className={styles.panels}>
          {/* ── Left panel: notes list (desktop only, hidden on mobile via CSS) ── */}
          <section className={`${styles.card} ${styles.mainPanel}`}>
            <NotesPanel />
          </section>

          {/* ── Right panel: page content + desktop nav ── */}
          <section className={`${styles.card} ${styles.rightPanel}`}>
            <div className={styles.rightPanelInner}>{children}</div>
            <div className={styles.desktopNav}>
              <BottomNav />
            </div>
          </section>
        </div>

        {/* ── ControlBar: separate card below panels ──
            Desktop: always visible.
            Mobile: only on the home/notes page. */}
        <div
          className={[
            styles.card,
            styles.controlBarWrapper,
            !isHome ? styles.controlBarHideMobile : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <ControlBar />
        </div>
      </main>

      {/* ── Mobile-only fixed footer nav ── */}
      <div className={styles.mobileNav}>
        <BottomNav />
      </div>
    </>
  );
}
