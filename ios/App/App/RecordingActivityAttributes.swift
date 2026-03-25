import ActivityKit
import Foundation

struct RecordingActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var status: String      // "recording" | "paused"
        var elapsedSeconds: Int
        var startedAt: Date
    }

    var recordingId: String
}
