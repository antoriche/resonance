import Foundation
import AVFoundation
import ActivityKit

final class RecordingEngine {
    static let shared = RecordingEngine()

    // MARK: - Types

    enum RecordingSource { case manual, auto }

    struct RecordingResult {
        let recordingId: String
        let status: String
        let elapsedSeconds: Int
    }

    enum RecordingError: LocalizedError {
        case alreadyRecording
        case notRecording
        case notPaused
        case failedToStart(String)

        var errorDescription: String? {
            switch self {
            case .alreadyRecording: return "Recording already in progress"
            case .notRecording: return "No recording in progress"
            case .notPaused: return "Not paused"
            case .failedToStart(let reason): return "Failed to start recording: \(reason)"
            }
        }
    }

    // MARK: - State

    private(set) var audioRecorder: AVAudioRecorder?
    private var recordingTimer: Timer?
    private(set) var elapsedSeconds: Int = 0
    private(set) var currentRecordingId: String?
    private var currentActivity: Any?
    private var chunkTimer: Timer?
    private var currentChunkIndex: Int = 0
    private(set) var isPaused: Bool = false
    private(set) var source: RecordingSource = .manual
    private var autoStartSuppressedUntil: Date?

    var uploadURL: String = "https://resonance-plum-five.vercel.app"

    /// Callback fired every second with (elapsedSeconds, status).
    /// The Capacitor plugin wires this to `notifyListeners`.
    var onTick: ((Int, String) -> Void)?

    var isRecording: Bool { audioRecorder != nil }

    var isAutoStartSuppressed: Bool {
        guard let until = autoStartSuppressedUntil else { return false }
        return Date() < until
    }

    // MARK: - Init

    private init() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Configuration

    func configure(uploadURL: String) {
        self.uploadURL = uploadURL
    }

    // MARK: - Start Recording

    @discardableResult
    func startRecording(source: RecordingSource = .manual) throws -> RecordingResult {
        // If already recording with .auto and a manual start comes in, promote
        if audioRecorder != nil && source == .manual && self.source == .auto {
            self.source = .manual
            return RecordingResult(
                recordingId: currentRecordingId ?? "",
                status: "recording",
                elapsedSeconds: elapsedSeconds
            )
        }

        guard audioRecorder == nil else {
            throw RecordingError.alreadyRecording
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothHFP])
            try session.setActive(true)

            let recordingId = UUID().uuidString
            self.currentRecordingId = recordingId
            self.currentChunkIndex = 0
            self.elapsedSeconds = 0
            self.isPaused = false
            self.source = source

            let fileURL = chunkFileURL(recordingId: recordingId, chunkIndex: 0)

            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 44100,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            ]

            audioRecorder = try AVAudioRecorder(url: fileURL, settings: settings)
            audioRecorder?.record()

            startElapsedTimer()
            startChunkTimer()

            if #available(iOS 16.2, *) {
                startLiveActivity(recordingId: recordingId)
            }

            return RecordingResult(recordingId: recordingId, status: "recording", elapsedSeconds: 0)
        } catch {
            throw RecordingError.failedToStart(error.localizedDescription)
        }
    }

    // MARK: - Stop Recording

    @discardableResult
    func stopRecording() throws -> RecordingResult {
        guard let recorder = audioRecorder else {
            throw RecordingError.notRecording
        }

        let currentURL = recorder.url
        recorder.stop()

        uploadChunkFile(at: currentURL, chunkIndex: currentChunkIndex)

        endLiveActivity()
        stopTimers()
        cleanupAudioSession()

        let recordingId = currentRecordingId ?? ""
        let elapsed = elapsedSeconds

        // If this was an auto session being stopped (likely manually), suppress re-trigger
        if source == .auto {
            autoStartSuppressedUntil = Date().addingTimeInterval(60)
        }

        audioRecorder = nil
        currentRecordingId = nil
        isPaused = false
        source = .manual

        return RecordingResult(recordingId: recordingId, status: "idle", elapsedSeconds: elapsed)
    }

    // MARK: - Pause Recording

    @discardableResult
    func pauseRecording() throws -> RecordingResult {
        guard let recorder = audioRecorder, recorder.isRecording else {
            throw RecordingError.notRecording
        }

        recorder.pause()
        isPaused = true
        recordingTimer?.invalidate()
        recordingTimer = nil
        updateLiveActivity(status: "paused")

        return RecordingResult(
            recordingId: currentRecordingId ?? "",
            status: "paused",
            elapsedSeconds: elapsedSeconds
        )
    }

    // MARK: - Resume Recording

    @discardableResult
    func resumeRecording() throws -> RecordingResult {
        guard audioRecorder != nil, isPaused else {
            throw RecordingError.notPaused
        }

        audioRecorder?.record()
        isPaused = false
        startElapsedTimer()
        updateLiveActivity(status: "recording")

        return RecordingResult(
            recordingId: currentRecordingId ?? "",
            status: "recording",
            elapsedSeconds: elapsedSeconds
        )
    }

    // MARK: - Get Status

    func getStatus() -> RecordingResult {
        let status: String
        if audioRecorder != nil {
            status = isPaused ? "paused" : "recording"
        } else {
            status = "idle"
        }
        return RecordingResult(
            recordingId: currentRecordingId ?? "",
            status: status,
            elapsedSeconds: elapsedSeconds
        )
    }

    // MARK: - Elapsed Timer

    private func startElapsedTimer() {
        recordingTimer?.invalidate()
        recordingTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.elapsedSeconds += 1

            let status = self.isPaused ? "paused" : "recording"
            self.onTick?(self.elapsedSeconds, status)
        }
    }

    // MARK: - Live Activity

    @available(iOS 16.2, *)
    private func startLiveActivity(recordingId: String) {
        let attributes = RecordingActivityAttributes(recordingId: recordingId)
        let initialState = RecordingActivityAttributes.ContentState(
            status: "recording",
            elapsedSeconds: 0,
            startedAt: Date()
        )

        do {
            let content = ActivityContent(state: initialState, staleDate: nil)
            let activity = try Activity.request(
                attributes: attributes,
                content: content,
                pushType: nil
            )
            self.currentActivity = activity
        } catch {
            print("[RecordingEngine] Failed to start Live Activity: \(error)")
        }
    }

    private func updateLiveActivity(status: String) {
        if #available(iOS 16.2, *) {
            guard let activity = currentActivity as? Activity<RecordingActivityAttributes> else { return }

            let updatedState = RecordingActivityAttributes.ContentState(
                status: status,
                elapsedSeconds: elapsedSeconds,
                startedAt: Date().addingTimeInterval(TimeInterval(-elapsedSeconds))
            )

            Task {
                let content = ActivityContent(state: updatedState, staleDate: nil)
                await activity.update(content)
            }
        }
    }

    private func endLiveActivity() {
        if #available(iOS 16.2, *) {
            guard let activity = currentActivity as? Activity<RecordingActivityAttributes> else { return }

            let finalState = RecordingActivityAttributes.ContentState(
                status: "idle",
                elapsedSeconds: elapsedSeconds,
                startedAt: Date()
            )

            Task {
                let content = ActivityContent(state: finalState, staleDate: nil)
                await activity.end(content, dismissalPolicy: .immediate)
            }
            currentActivity = nil
        }
    }

    // MARK: - Chunk Management

    private func chunkFileURL(recordingId: String, chunkIndex: Int) -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("recording-\(recordingId)-\(chunkIndex).m4a")
    }

    private func startChunkTimer() {
        chunkTimer?.invalidate()
        chunkTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            self?.rotateChunk()
        }
    }

    private func rotateChunk() {
        guard let recorder = audioRecorder, recorder.isRecording else { return }

        let completedURL = recorder.url
        recorder.stop()

        uploadChunkFile(at: completedURL, chunkIndex: currentChunkIndex)
        currentChunkIndex += 1

        let newURL = chunkFileURL(recordingId: currentRecordingId ?? "unknown", chunkIndex: currentChunkIndex)

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]

        do {
            audioRecorder = try AVAudioRecorder(url: newURL, settings: settings)
            audioRecorder?.record()
        } catch {
            print("[RecordingEngine] Failed to restart recording for new chunk: \(error)")
        }
    }

    private func uploadChunkFile(at fileURL: URL, chunkIndex: Int) {
        guard let audioData = try? Data(contentsOf: fileURL) else { return }

        let url = URL(string: "\(uploadURL)/api/audio/upload")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        let filename = "chunk-\(Int(Date().timeIntervalSince1970 * 1000)).m4a"
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/mp4\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        URLSession.shared.dataTask(with: request) { _, _, error in
            if let error = error {
                print("[RecordingEngine] Chunk upload failed: \(error)")
            }
            try? FileManager.default.removeItem(at: fileURL)
        }.resume()
    }

    // MARK: - Interruption Handling

    @objc private func handleInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
            return
        }

        switch type {
        case .began:
            if let recorder = audioRecorder, recorder.isRecording {
                recorder.pause()
                isPaused = true
                recordingTimer?.invalidate()
                recordingTimer = nil
                updateLiveActivity(status: "paused")
                onTick?(elapsedSeconds, "paused")
            }
        case .ended:
            if let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt {
                let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                if options.contains(.shouldResume), audioRecorder != nil, isPaused {
                    audioRecorder?.record()
                    isPaused = false
                    startElapsedTimer()
                    updateLiveActivity(status: "recording")
                }
            }
        @unknown default:
            break
        }
    }

    // MARK: - Cleanup

    private func stopTimers() {
        recordingTimer?.invalidate()
        recordingTimer = nil
        chunkTimer?.invalidate()
        chunkTimer = nil
    }

    private func cleanupAudioSession() {
        try? AVAudioSession.sharedInstance().setActive(false)
    }
}
