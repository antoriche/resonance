import Foundation
import Capacitor
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
        CAPPluginMethod(name: "setAutoRecordEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAutoRecordEnabled", returnType: CAPPluginReturnPromise),
    ]

    private var engine: RecordingEngine { RecordingEngine.shared }

    // MARK: - Lifecycle

    override public func load() {
        if let serverUrl = getConfig().getString("serverUrl") {
            engine.configure(uploadURL: serverUrl)
        } else {
            engine.configure(uploadURL: "https://resonance-plum-five.vercel.app")
        }

        engine.onTick = { [weak self] elapsed, status in
            self?.notifyListeners("recordingTick", data: [
                "elapsedSeconds": elapsed,
                "status": status,
            ])
        }

        engine.onStateChange = { [weak self] status, elapsed in
            self?.notifyListeners("recordingStateChange", data: [
                "status": status,
                "elapsedSeconds": elapsed,
            ])
        }
    }

    // MARK: - Recording

    @objc func startRecording(_ call: CAPPluginCall) {
        do {
            let result = try engine.startRecording(source: .manual)
            call.resolve(["recordingId": result.recordingId, "status": result.status])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func stopRecording(_ call: CAPPluginCall) {
        do {
            // User manually stopped — suppress auto-restart if it was an auto session
            let suppress = engine.source == .auto
            let result = try engine.stopRecording(suppressAutoRestart: suppress)
            call.resolve([
                "recordingId": result.recordingId,
                "status": result.status,
                "elapsedSeconds": result.elapsedSeconds,
            ])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func pauseRecording(_ call: CAPPluginCall) {
        do {
            let result = try engine.pauseRecording()
            call.resolve(["status": result.status, "elapsedSeconds": result.elapsedSeconds])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func resumeRecording(_ call: CAPPluginCall) {
        do {
            let result = try engine.resumeRecording()
            call.resolve(["status": result.status, "elapsedSeconds": result.elapsedSeconds])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func getRecordingStatus(_ call: CAPPluginCall) {
        let result = engine.getStatus()
        call.resolve(["status": result.status, "elapsedSeconds": result.elapsedSeconds])
    }

    // MARK: - Auto-Record Settings

    @objc func setAutoRecordEnabled(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        UserDefaults.standard.set(enabled, forKey: "autoRecordEnabled")

        if enabled {
            AutoRecordMonitor.shared.activate()
        } else {
            AutoRecordMonitor.shared.deactivate()
        }

        call.resolve(["enabled": enabled])
    }

    @objc func getAutoRecordEnabled(_ call: CAPPluginCall) {
        let enabled = UserDefaults.standard.bool(forKey: "autoRecordEnabled")
        call.resolve(["enabled": enabled])
    }
}
