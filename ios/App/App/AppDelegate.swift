import UIKit
import Capacitor
import AVFoundation
import BackgroundTasks

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    static let bgTaskIdentifier = "ai.resonance.autorecord.check"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Configure audio session for background recording
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothHFP])
        } catch {
            print("[AppDelegate] Audio session configuration failed: \(error)")
        }

        // Configure RecordingEngine default upload URL (plugin load() may override)
        RecordingEngine.shared.configure(uploadURL: "https://resonance-plum-five.vercel.app")

        // Register BGProcessingTask for auto-record checks while suspended
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.bgTaskIdentifier,
            using: nil
        ) { task in
            self.handleBackgroundTask(task as! BGProcessingTask)
        }

        // Activate auto-record monitor if user enabled it
        if UserDefaults.standard.bool(forKey: "autoRecordEnabled") {
            AutoRecordMonitor.shared.activate()
        }

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        scheduleBackgroundTask()
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Re-evaluate auto-record conditions when returning to foreground
        if UserDefaults.standard.bool(forKey: "autoRecordEnabled") {
            AutoRecordMonitor.shared.evaluateConditions()
        }
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    // MARK: - Background Task

    private func scheduleBackgroundTask() {
        let request = BGProcessingTaskRequest(identifier: Self.bgTaskIdentifier)
        request.requiresExternalPower = true
        request.requiresNetworkConnectivity = true

        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("[AppDelegate] Failed to schedule background task: \(error)")
        }
    }

    private func handleBackgroundTask(_ task: BGProcessingTask) {
        // Schedule the next occurrence
        scheduleBackgroundTask()

        task.expirationHandler = {
            // If recording started, audio background mode keeps us alive.
            // Nothing to clean up here.
        }

        guard UserDefaults.standard.bool(forKey: "autoRecordEnabled") else {
            task.setTaskCompleted(success: true)
            return
        }

        // Activate monitor and evaluate — if conditions are met, recording starts
        // and the audio background mode takes over keeping the app alive.
        AutoRecordMonitor.shared.activate()
        AutoRecordMonitor.shared.evaluateConditions()

        task.setTaskCompleted(success: true)
    }

    // MARK: - URL Handling

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
