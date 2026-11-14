import SwiftUI
import ActivityKit

@main
struct PrototypeApp: App {
    var body: some Scene { WindowGroup { PrototypeView() } }
}

struct PrototypeView: View {
    @Environment(\.scenePhase) private var scenePhase
    // Deliberately memory-only: each launch requires fresh disclosure consent.
    @State private var disclose = false
    @State private var activity: Activity<ServiceAttributes>?
    @State private var ordinal = 1
    @State private var paused = false
    @State private var status = "off"
    @State private var diagnostic = ""
    @State private var requestMetadata = ""
    private var content: ActivityContent<ServiceAttributes.ContentState> {
        ActivityContent(state: .init(ordinal: ordinal, occurrenceID: ServiceAttributes.occurrenceIDs[ordinal - 1], role: ServiceAttributes.roles[ordinal - 1],
                                    updatedAt: Date(), paused: paused),
                        staleDate: Date().addingTimeInterval(60))
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
                    // A native button-style Toggle keeps consent explicit and accessible
                    // without depending on the simulator's nested UISwitch hit target.
                    Toggle(disclose ? "revokeDisclosure" : "allowDisclosure", isOn: $disclose)
                        .toggleStyle(.button)
                        .accessibilityIdentifier("disclosure")
                        .onChange(of: disclose) { enabled in
                            if !enabled { Task { await remove() } }
                        }
                    Text("disclosureHelp").font(.footnote)
                    Button("start") { start() }
                        .disabled(!disclose || activity != nil || scenePhase != .active)
                    Text(LocalizedStringKey(status)).accessibilityIdentifier("status")
                        .accessibilityValue(requestMetadata)
                    if !diagnostic.isEmpty { Text(verbatim: diagnostic).font(.caption).accessibilityIdentifier("diagnostic") }
                }
                Section("localControls") {
                    Button("advance") {
                        guard ordinal < ServiceAttributes.occurrenceIDs.count else { return }
                        ordinal += 1
                        Task { await activity?.update(content) }
                    }.disabled(ordinal >= ServiceAttributes.occurrenceIDs.count)
                    Button(paused ? "resume" : "pause") {
                        paused.toggle()
                        Task { await activity?.update(content) }
                    }
                    Button("remove", role: .destructive) { Task { await remove() } }
                }.disabled(activity == nil || scenePhase != .active)
                Text("expiryHelp").font(.footnote)
            }
            .navigationTitle("title")
            .task {
                // Do not silently regain permission after termination/relaunch.
                for existing in Activity<ServiceAttributes>.activities {
                    await existing.end(nil, dismissalPolicy: .immediate)
                }
            }
        }
    }
    private func start() {
        guard disclose, scenePhase == .active, activity == nil else { return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { status = "unavailable"; return }
        do {
            ordinal = 1; paused = false
            let requested = try Activity.request(attributes: ServiceAttributes(serviceID: 42), content: content, pushType: nil)
            activity = requested
            status = "started"
            // Read back ActivityKit's returned content, not merely the intended +60s bound.
            let acceptedStaleDate = requested.content.staleDate?.ISO8601Format() ?? "nil"
            requestMetadata = "requestedAt=\(Date().ISO8601Format()) updatedAt=\(requested.content.state.updatedAt.ISO8601Format()) staleDate=\(acceptedStaleDate) activityState=\(String(describing: requested.activityState)) pushType=nil"
            print("PROTOTYPE \(requestMetadata)")
        } catch {
            status = "failed"
            diagnostic = String(describing: error)
            print("PROTOTYPE request failed: \(error)")
        }
    }
    private func remove() async {
        for existing in Activity<ServiceAttributes>.activities {
            await existing.end(nil, dismissalPolicy: .immediate)
        }
        activity = nil; status = "off"
    }
}
