import styles from "./views.module.css";

export default function RecordView() {
  return (
    <div className={styles.viewContainer}>
      <div className={styles.viewContent}>
        <p className={styles.placeholder}>Recording coming soon.</p>
      </div>
    </div>
  );
}
