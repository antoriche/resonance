import UIKit
import AVFoundation

final class AutoRecordMonitor {
    static let shared = AutoRecordMonitor()

    private var isActive = false
    private var engine: RecordingEngine { RecordingEngine.shared }

    private var isCharging: Bool {
        let state = UIDevice.current.batteryState
        return state == .charging || state == .full
    }

    // MARK: - Activate / Deactivate

    func activate() {
        guard !isActive else { return }
        isActive = true

        UIDevice.current.isBatteryMonitoringEnabled = true

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(batteryStateChanged),
            name: UIDevice.batteryStateDidChangeNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(audioSessionChanged(_:)),
            name: AVAudioSession.silenceSecondaryAudioHintNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(audioRouteChanged(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )

        evaluateConditions()
    }

    func deactivate() {
        guard isActive else { return }
        isActive = false

        NotificationCenter.default.removeObserver(self)
        UIDevice.current.isBatteryMonitoringEnabled = false

        // Stop auto-recording if it was auto-started
        if engine.isRecording && engine.source == .auto {
            try? engine.stopRecording()
        }
    }

    // MARK: - Notification Handlers

    @objc private func batteryStateChanged() {
        evaluateConditions()
    }

    @objc private func audioSessionChanged(_ notification: Notification) {
        evaluateConditions()
    }

    @objc private func audioRouteChanged(_ notification: Notification) {
        // Small delay to let the audio system settle after route changes
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.evaluateConditions()
        }
    }

    // MARK: - Core Logic

    func evaluateConditions() {
        guard isActive else { return }

        // Check isOtherAudioPlaying BEFORE we might activate our own audio session.
        // Once our session is active with .playAndRecord, other audio may be interrupted.
        let isMusicPlaying = AVAudioSession.sharedInstance().isOtherAudioPlaying
        let shouldRecord = isCharging && !isMusicPlaying

        if shouldRecord && !engine.isRecording && !engine.isAutoStartSuppressed {
            do {
                _ = try engine.startRecording(source: .auto)
                print("[AutoRecordMonitor] Auto-recording started (charging + no music)")
            } catch {
                print("[AutoRecordMonitor] Failed to auto-start recording: \(error)")
            }
        } else if !shouldRecord && engine.isRecording && engine.source == .auto {
            // Stop auto-recording only if WE started it
            do {
                _ = try engine.stopRecording()
                print("[AutoRecordMonitor] Auto-recording stopped (conditions no longer met)")
            } catch {
                print("[AutoRecordMonitor] Failed to auto-stop recording: \(error)")
            }
        }
        // If engine.source == .manual, never interfere
    }
}
