"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import ResonanceRecorder from "@/lib/client/plugins/resonance-recorder";
import styles from "./views.module.css";

export default function SettingsView() {
  const isIOS = Capacitor.getPlatform() === "ios";
  const [autoRecord, setAutoRecord] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isIOS) {
      setLoading(false);
      return;
    }
    ResonanceRecorder.getAutoRecordEnabled()
      .then(({ enabled }) => setAutoRecord(enabled))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isIOS]);

  const toggleAutoRecord = async () => {
    const next = !autoRecord;
    setAutoRecord(next);
    try {
      await ResonanceRecorder.setAutoRecordEnabled({ enabled: next });
    } catch {
      setAutoRecord(!next);
    }
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.viewContent}>
        {isIOS && !loading && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "0.75rem 0",
              cursor: "pointer",
            }}
          >
            <div>
              <div style={{ fontWeight: 500 }}>Auto-record when charging</div>
              <div style={{ fontSize: "0.8rem", opacity: 0.5, marginTop: 2 }}>
                Starts recording when plugged in and no music is playing
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoRecord}
              onChange={toggleAutoRecord}
              style={{ width: 20, height: 20, cursor: "pointer" }}
            />
          </label>
        )}
        {!isIOS && <p className={styles.placeholder}>Settings coming soon.</p>}
      </div>
    </div>
  );
}
