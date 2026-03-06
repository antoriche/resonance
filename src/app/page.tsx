import ControlBar from "@/components/ControlBar/ControlBar";
import styles from "./root.module.css";
import ChatPanel from "@/components/ChatPanel/ChatPanel";
import mockMessages from "@/assets/mocks/messages";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.panels}>
        <section className={`${styles.card} ${styles.leftPanel}`}>A</section>
        <section className={`${styles.card} ${styles.mainPanel}`}>
          <ChatPanel messages={mockMessages} />
        </section>
        <section className={`${styles.card} ${styles.rightPanel}`}>C</section>
      </div>
      <section className={`${styles.card} ${styles.bottomPanel}`}>
        <ControlBar />
      </section>
    </main>
  );
}
