import SwiftUI
import ActivityKit

@main
struct PrototypeApp: App {
    var body: some Scene { WindowGroup { PrototypeView() } }
}

struct PrototypeView: View {
    @Environment(\.scenePhase) private var scenePhase
    // Memory-only: each launch and each follow requires fresh disclosure consent.
    @State private var disclose = false
    @State private var activity: Activity<ServicePublicationIdentity>?
    @State private var store: ServicePublicationStore?
    @State private var generation = UUID().uuidString.lowercased()
    @State private var sequence = 0
    @State private var ordinal = 1
    @State private var paused = false
    @State private var variant = "ordered"
    @State private var busy = true
    @State private var remoteActive = false
    @State private var status = "off"
    @State private var requestMetadata = ""
    private let roles = ["priest", "choir", "people"]
    private var identity: ServicePublicationIdentity {
        ServicePublicationIdentity(serviceID: 42, generation: generation)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("synthetic").font(.headline)
                    Text("localOnly")
                    Link("publicLink", destination: ServiceAttributes.publicURL)
                }
                Section {
                    Text(disclose ? "disclosureOn" : "disclosureOff")
                        .accessibilityIdentifier("disclosureState")
                    Toggle(disclose ? "revokeDisclosure" : "allowDisclosure", isOn: $disclose)
                        .toggleStyle(.button)
                        .accessibilityIdentifier("disclosure")
                        .disabled(busy || remoteActive)
                        .onChange(of: disclose) { enabled in
                            if !enabled && !remoteActive {
                                busy = true
                                Task { await remove() }
                            }
                        }
                    Text("disclosureHelp").font(.footnote)
                    Button("start") { start() }
                        .disabled(!disclose || activity != nil || busy || remoteActive || scenePhase != .active)
                    Text(LocalizedStringKey(status)).accessibilityIdentifier("status")
                        .accessibilityValue(requestMetadata)
                }
                Section("localControls") {
                    Button("advance") { ordinal += 1; variant = "ordered"; update() }
                        .disabled(ordinal >= 3)
                    Button(paused ? "resume" : "pause") { paused.toggle(); update() }
                    Button("publicationUnknownAction") { variant = "unknown"; update() }
                    Button("publicationEmptyAction") { variant = "empty"; update() }
                    Button("publicationOrderedAction") { variant = "ordered"; update() }
                    Button("publicationDeleteAction", role: .destructive) { finishDeleted() }
                    Button("remove", role: .destructive) {
                        busy = true
                        Task { await remove() }
                    }
                }.disabled(activity == nil || busy || remoteActive || scenePhase != .active)
                if let store {
                    Section("publicationPreview") {
                        ServicePublicationCard(presentation: store.presentation(now: Date()))
                    }
                }
                ServiceRemoteExperimentView(remoteActive: $remoteActive, ready: !busy) {
                    disclose = false
                    await remove()
                }
                Text("expiryHelp").font(.footnote)
            }
            .navigationTitle("title")
            .task {
                // Clean up only this isolated app's old baseline and v1 Activities.
                // No consent or previous Activity is silently restored on relaunch.
                for existing in Activity<ServiceAttributes>.activities {
                    await existing.end(nil, dismissalPolicy: .immediate)
                }
                for existing in Activity<ServicePublicationIdentity>.activities {
                    await existing.end(nil, dismissalPolicy: .immediate)
                }
                busy = false
            }
        }
    }

    // Local synthetic publication source, not a backend projection or heartbeat.
    private func publication(deleted: Bool = false) -> ServicePublicationV1 {
        sequence += 1
        let now = Date()
        let ordered = variant == "ordered" && !deleted
        return ServicePublicationV1(
            schemaVersion: 1, sessionID: 42, generation: generation, sequence: sequence,
            stateRevision: deleted ? nil : sequence,
            contentContext: deleted || variant == "unknown" ? nil : "synthetic-v1-\(variant)",
            serviceTitle: deleted ? nil : NSLocalizedString("synthetic", comment: ""),
            status: deleted ? "deleted" : (paused ? "paused" : "active"),
            occurrenceID: ordered ? ServiceAttributes.occurrenceIDs[ordinal - 1] : nil,
            ordinal: ordered ? ordinal : nil,
            total: deleted || variant == "unknown" ? nil : (variant == "empty" ? 0 : 3),
            role: ordered ? roles[ordinal - 1] : nil,
            updatedAt: now, expiresAt: now.addingTimeInterval(60))
    }

    private func start() {
        guard disclose, scenePhase == .active, activity == nil, !busy, !remoteActive else { return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { status = "unavailable"; return }
        generation = UUID().uuidString.lowercased()
        sequence = 0; ordinal = 1; paused = false; variant = "ordered"
        let state = publication()
        var candidate = ServicePublicationStore(identity: identity)
        guard candidate.accept(state, now: Date()) else { status = "failed"; return }
        do {
            let requested = try Activity.request(attributes: identity,
                content: ActivityContent(state: state, staleDate: state.expiresAt), pushType: nil)
            activity = requested; store = candidate; status = "started"
            requestMetadata = "requestedAt=\(Date().ISO8601Format()) updatedAt=\(requested.content.state.updatedAt.ISO8601Format()) staleDate=\(requested.content.staleDate?.ISO8601Format() ?? "nil") activityState=\(String(describing: requested.activityState)) pushType=nil schemaVersion=1"
            print("PROTOTYPE \(requestMetadata)")
        } catch {
            // Do not log arbitrary system errors or credentials in diagnostics.
            status = "failed"
        }
    }

    private func update() {
        guard let target = activity, var candidate = store, !busy else { return }
        let state = publication()
        guard candidate.accept(state, now: Date()) else { status = "failed"; return }
        store = candidate; busy = true
        Task {
            await target.update(ActivityContent(state: state, staleDate: state.expiresAt))
            busy = false
        }
    }

    private func finishDeleted() {
        guard let target = activity, var candidate = store, !busy else { return }
        let state = publication(deleted: true)
        guard candidate.accept(state, now: Date()) else { status = "failed"; return }
        store = candidate; busy = true
        Task {
            await target.end(ActivityContent(state: state, staleDate: state.expiresAt), dismissalPolicy: .immediate)
            activity = nil; status = "off"; busy = false
        }
    }

    private func remove() async {
        store?.remove()
        for existing in Activity<ServicePublicationIdentity>.activities {
            await existing.end(nil, dismissalPolicy: .immediate)
        }
        for existing in Activity<ServiceAttributes>.activities {
            await existing.end(nil, dismissalPolicy: .immediate)
        }
        activity = nil; store = nil; requestMetadata = ""; status = "off"; busy = false
    }
}
