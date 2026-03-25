import ActivityKit
import WidgetKit
import SwiftUI

struct RecordingWidgetExtensionLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RecordingActivityAttributes.self) { context in
            // Lock Screen / StandBy banner
            LockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("REC", systemImage: context.state.status == "recording"
                        ? "record.circle.fill"
                        : "pause.circle.fill")
                        .font(.caption2)
                        .foregroundColor(context.state.status == "recording" ? .red : .orange)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(formatTime(context.state.elapsedSeconds))
                        .font(.system(.title3, design: .monospaced))
                        .foregroundColor(.white)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text("Resonance.ai")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Image(systemName: "waveform")
                            .foregroundColor(context.state.status == "recording" ? .red : .gray)
                        Text(context.state.status == "recording" ? "Recording..." : "Paused")
                            .font(.caption)
                    }
                }
            } compactLeading: {
                Image(systemName: context.state.status == "recording"
                    ? "record.circle.fill"
                    : "pause.circle.fill")
                    .foregroundColor(context.state.status == "recording" ? .red : .orange)
            } compactTrailing: {
                Text(formatTime(context.state.elapsedSeconds))
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(.white)
            } minimal: {
                Image(systemName: "record.circle.fill")
                    .foregroundColor(.red)
            }
        }
    }

    private func formatTime(_ totalSeconds: Int) -> String {
        let m = totalSeconds / 60
        let s = totalSeconds % 60
        return String(format: "%02d:%02d", m, s)
    }
}

struct LockScreenView: View {
    let context: ActivityViewContext<RecordingActivityAttributes>

    var body: some View {
        HStack {
            Image(systemName: context.state.status == "recording"
                ? "record.circle.fill"
                : "pause.circle.fill")
                .foregroundColor(context.state.status == "recording" ? .red : .orange)
                .font(.title2)

            VStack(alignment: .leading) {
                Text("Resonance.ai")
                    .font(.headline)
                Text(context.state.status == "recording" ? "Recording" : "Paused")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Text(formatTime(context.state.elapsedSeconds))
                .font(.system(.title2, design: .monospaced))
                .foregroundColor(.white)
        }
        .padding()
        .activityBackgroundTint(.black.opacity(0.8))
    }

    private func formatTime(_ totalSeconds: Int) -> String {
        let m = totalSeconds / 60
        let s = totalSeconds % 60
        return String(format: "%02d:%02d", m, s)
    }
}
