import ActivityKit
import SwiftUI
import WidgetKit

@main
struct ServiceActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ServiceAttributes.self) { context in
            VStack(alignment: .leading, spacing: 6) {
                Text("synthetic").font(.caption.bold())
                progress(context)
                HStack {
                    Text("updated")
                    Text(context.state.updatedAt, style: .time)
                }.font(.caption)
                Text("publicLink").font(.caption)
            }
            .padding()
            .activityBackgroundTint(Color.black)
            .activitySystemActionForegroundColor(.white)
            .foregroundStyle(.white)
            .widgetURL(ServiceAttributes.publicURL)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Text("service42").font(.caption) }
                DynamicIslandExpandedRegion(.trailing) { Text("syntheticShort").font(.caption) }
                DynamicIslandExpandedRegion(.center) { progress(context) }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text("updated")
                        Text(context.state.updatedAt, style: .time)
                        Text("publicLink")
                    }.font(.caption2)
                }
            } compactLeading: {
                Text(context.isStale ? "staleShort" : "syntheticShort")
            } compactTrailing: {
                if context.isStale { Image(systemName: "clock.badge.exclamationmark") }
                else { Text("\(context.state.ordinal)/3") }
            } minimal: {
                if context.isStale { Image(systemName: "clock.badge.exclamationmark").accessibilityLabel(Text("stale")) }
                else { Text("\(context.state.ordinal)/3") }
            }
            .widgetURL(ServiceAttributes.publicURL)
        }
    }
    @ViewBuilder
    private func progress(_ context: ActivityViewContext<ServiceAttributes>) -> some View {
        if context.isStale {
            Text("stale").font(.headline)
        } else {
            HStack {
                Text("part")
                Text("\(context.state.ordinal)/3").monospacedDigit()
                Text(LocalizedStringKey(context.state.role))
                if context.state.paused { Text("paused") }
            }.font(.headline)
        }
    }
}
