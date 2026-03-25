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
                Image(systemName: "waveform")
                    .foregroundColor(context.state.status == "recording" ? .red : .gray)
            } minimal: {
                Image(systemName: "record.circle.fill")
                    .foregroundColor(.red)
            }
        }
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
        }
        .padding()
        .activityBackgroundTint(.black.opacity(0.8))
    }
}
