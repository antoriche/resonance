import Foundation
import Capacitor
import ActivityKit
import AVFoundation

@objc(ResonanceRecorderPlugin)
public class ResonanceRecorderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ResonanceRecorderPlugin"
    public let jsName = "ResonanceRecorder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pauseRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resumeRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRecordingStatus", returnType: CAPPluginReturnPromise),
    ]

    private var audioRecorder: AVAudioRecorder?
    private var recordingTimer: Timer?
    private var elapsedSeconds: Int = 0
    private var currentRecordingId: String?
    private var currentActivity: Any? // Activity<RecordingActivityAttributes>, type-erased for availability
    private var chunkTimer: Timer?
    private var currentChunkIndex: Int = 0
    private var uploadURL: String = ""
    private var isPaused: Bool = false

    // MARK: - Lifecycle

    override public func load() {
        if let serverUrl = getConfig().getString("serverUrl") {
            self.uploadURL = serverUrl
        } else {
            self.uploadURL = "https://resonance-plum-five.vercel.app"
        }

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

    // MARK: - Start Recording

    @objc func startRecording(_ call: CAPPluginCall) {
        guard audioRecorder == nil else {
            call.reject("Recording already in progress")
            return
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

            call.resolve(["recordingId": recordingId, "status": "recording"])
        } catch {
            call.reject("Failed to start recording: \(error.localizedDescription)")
        }
    }

    // MARK: - Stop Recording

    @objc func stopRecording(_ call: CAPPluginCall) {
        guard let recorder = audioRecorder else {
            call.reject("No recording in progress")
            return
        }

        let currentURL = recorder.url
        recorder.stop()

        // Upload the final chunk
        uploadChunkFile(at: currentURL, chunkIndex: currentChunkIndex)

        endLiveActivity()
        stopTimers()
        cleanupAudioSession()

        let recordingId = currentRecordingId ?? ""
        let elapsed = elapsedSeconds
        audioRecorder = nil
        currentRecordingId = nil
        isPaused = false

        call.resolve(["recordingId": recordingId, "status": "idle", "elapsedSeconds": elapsed])
    }

    // MARK: - Pause Recording

    @objc func pauseRecording(_ call: CAPPluginCall) {
        guard let recorder = audioRecorder, recorder.isRecording else {
            call.reject("Not currently recording")
            return
        }

        recorder.pause()
        isPaused = true
        recordingTimer?.invalidate()
        recordingTimer = nil
        updateLiveActivity(status: "paused")

        call.resolve(["status": "paused", "elapsedSeconds": elapsedSeconds])
    }

    // MARK: - Resume Recording

    @objc func resumeRecording(_ call: CAPPluginCall) {
        guard audioRecorder != nil, isPaused else {
            call.reject("Not paused")
            return
        }

        audioRecorder?.record()
        isPaused = false
        startElapsedTimer()
        updateLiveActivity(status: "recording")

        call.resolve(["status": "recording", "elapsedSeconds": elapsedSeconds])
    }

    // MARK: - Get Status

    @objc func getRecordingStatus(_ call: CAPPluginCall) {
        let status: String
        if audioRecorder != nil {
            status = isPaused ? "paused" : "recording"
        } else {
            status = "idle"
        }
        call.resolve(["status": status, "elapsedSeconds": elapsedSeconds])
    }

    // MARK: - Elapsed Timer

    private func startElapsedTimer() {
        recordingTimer?.invalidate()
        recordingTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.elapsedSeconds += 1

            self.notifyListeners("recordingTick", data: [
                "elapsedSeconds": self.elapsedSeconds,
                "status": self.isPaused ? "paused" : "recording",
            ])
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
            print("[ResonanceRecorder] Failed to start Live Activity: \(error)")
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
            print("[ResonanceRecorder] Failed to restart recording for new chunk: \(error)")
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
                print("[ResonanceRecorder] Chunk upload failed: \(error)")
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
                notifyListeners("recordingTick", data: [
                    "elapsedSeconds": elapsedSeconds,
                    "status": "paused",
                ])
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
