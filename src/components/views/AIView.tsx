import styles from "./views.module.css";

export default function AIView() {
  return (
    <div className={styles.viewContainer}>
      <div className={styles.viewContent}>
        <p className={styles.placeholder}>AI chatbot coming soon.</p>
      </div>
    </div>
  );
}
