import ActivityKit
import SwiftUI
import WidgetKit

@main
struct ServiceActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ServicePublicationIdentity.self) { context in
            let presentation = ServicePublicationValidator.presentation(
                context.state, identity: context.attributes, now: Date(), nativeIsStale: context.isStale)
            ServicePublicationCard(presentation: presentation)
                .padding()
                .activityBackgroundTint(Color.black)
                .activitySystemActionForegroundColor(.white)
                .foregroundStyle(.white)
                .widgetURL(presentation.tapURL)
        } dynamicIsland: { context in
            let presentation = ServicePublicationValidator.presentation(
                context.state, identity: context.attributes, now: Date(), nativeIsStale: context.isStale)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    if let title = presentation.title { Text(verbatim: title).font(.caption).lineLimit(2) }
                }
                DynamicIslandExpandedRegion(.center) {
                    ServicePublicationProgressView(presentation: presentation)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if let updatedAt = presentation.updatedAt {
                        HStack {
                            Text("updated")
                            Text(updatedAt, style: .time)
                            if presentation.tapURL != nil { Text("publicLink") }
                        }.font(.caption2)
                    }
                }
            } compactLeading: {
                Text(presentation.freshness == .stale ? "staleShort" : "syntheticShort")
            } compactTrailing: {
                compactProgress(presentation)
            } minimal: {
                compactProgress(presentation)
            }
            .widgetURL(presentation.tapURL)
        }
    }

    @ViewBuilder
    private func compactProgress(_ presentation: ServicePublicationPresentation) -> some View {
        if presentation.freshness == .stale {
            Image(systemName: "clock.badge.exclamationmark").accessibilityLabel(Text("stale"))
        } else if presentation.freshness == .recent,
                  let ordinal = presentation.ordinal, let total = presentation.total {
            Text("\(ordinal)/\(total)")
        } else {
            Image(systemName: "questionmark.circle").accessibilityLabel(Text("publicationUnavailable"))
        }
    }
}
