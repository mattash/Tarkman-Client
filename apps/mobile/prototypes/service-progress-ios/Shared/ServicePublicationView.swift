import SwiftUI

// Stateless rendering only. iOS controls redraw scheduling; neither this view nor
// a dynamic sequence field can enforce APNs ordering while the app is terminated.
struct ServicePublicationProgressView: View {
    let presentation: ServicePublicationPresentation

    var body: some View {
        if presentation.freshness == .invalid || presentation.freshness == .removed {
            Text("publicationUnavailable").font(.headline)
        } else if presentation.status == "deleted" {
            Text("publicationDeleted").font(.headline)
        } else if presentation.status == "ended" {
            Text("publicationEnded").font(.headline)
        } else if presentation.status == "unavailable" {
            Text("publicationUnavailable").font(.headline)
        } else if presentation.freshness == .stale {
            Text("stale").font(.headline)
        } else {
            VStack(alignment: .leading, spacing: 4) {
                if let ordinal = presentation.ordinal, let total = presentation.total {
                    HStack {
                        Text("part")
                        Text("\(ordinal)/\(total)").monospacedDigit()
                        if let role = presentation.role {
                            Text(LocalizedStringKey("role." + role))
                        }
                    }
                } else {
                    Text(presentation.total == 0 ? "publicationEmpty" : "publicationUnknown")
                }
                if presentation.status == "paused" { Text("paused") }
            }.font(.headline)
        }
    }
}

struct ServicePublicationCard: View {
    let presentation: ServicePublicationPresentation

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let title = presentation.title { Text(verbatim: title).font(.caption.bold()) }
            ServicePublicationProgressView(presentation: presentation)
            if let updatedAt = presentation.updatedAt {
                HStack {
                    Text("updated")
                    Text(updatedAt, style: .time)
                }.font(.caption)
            }
            if presentation.tapURL != nil { Text("publicLink").font(.caption) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("service-publication-card")
    }
}
