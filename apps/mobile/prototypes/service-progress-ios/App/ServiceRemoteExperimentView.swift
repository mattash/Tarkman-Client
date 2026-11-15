import SwiftUI

struct ServiceRemoteExperimentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var caller: ServiceRemoteExperimentController
    @Binding var remoteActive: Bool
    let ready: Bool
    let selectedServiceID: Int?
    let beforeStart: () async -> Void

    init(remoteActive: Binding<Bool>, ready: Bool,
         controller: ServiceRemoteExperimentController? = nil, selectedServiceID: Int? = nil,
         beforeStart: @escaping () async -> Void) {
        _caller = StateObject(wrappedValue: controller ?? ServiceRemoteExperimentController())
        _remoteActive = remoteActive
        self.ready = ready
        self.selectedServiceID = selectedServiceID
        self.beforeStart = beforeStart
    }

    var body: some View {
        Section("remoteSection") {
            Text(caller.isSimulatorFixture ? "remoteSimulatorHelp" : "remoteExperimentHelp").font(.footnote)
            if let selectedServiceID, (caller.isActive || caller.pendingRecovery), Int(caller.serviceInput) != selectedServiceID {
                Text("remoteOtherService").font(.footnote)
            }
            Text(LocalizedStringKey(caller.messageKey)).accessibilityIdentifier("remoteStatus")
            TextField("remoteServiceID", text: $caller.serviceInput)
                .keyboardType(.numberPad)
                .accessibilityIdentifier("remoteServiceID")
                .disabled(selectedServiceID != nil || !caller.canVerify || !ready || scenePhase != .active)
            Button("remoteVerify") { Task { await caller.verifySelection() } }
                .disabled(!caller.canVerify || !ready || scenePhase != .active)
            if let selected = caller.selection {
                Text(verbatim: selected.title).font(.headline)
                Text("remoteDisclosureHelp").font(.footnote)
                Toggle("remoteAllowDisclosure", isOn: $caller.disclosed)
                    .disabled(caller.busy || scenePhase != .active)
                    .onChange(of: caller.disclosed) { allowed in
                        if !allowed && caller.isActive && !caller.busy {
                            Task { await caller.remove(); remoteActive = caller.isActive }
                        }
                    }
            }
            Button("remoteStart") {
                // Block local fixture requests before cleanup suspends; the remote
                // controller rechecks consent, selection age and durable recovery.
                remoteActive = true
                Task {
                    await beforeStart()
                    await caller.start()
                    remoteActive = caller.isActive
                }
            }.disabled(!caller.canStart || !ready || scenePhase != .active)
            Button("remoteRetry") { Task { await caller.retryRegistration() } }
                .disabled(!caller.isActive || caller.busy || scenePhase != .active)
            Button("remoteRevoke", role: .destructive) {
                Task { await caller.remove(); remoteActive = caller.isActive }
            }.disabled((!caller.isActive && !caller.pendingRecovery) || caller.busy || scenePhase != .active)
            if caller.pendingRecovery {
                Text("remoteRecoveryHelp").font(.footnote)
            }
        }
        .onAppear { alignSelectedService() }
        .onChange(of: caller.isActive) { active in
            remoteActive = active
            alignSelectedService()
        }
        .onChange(of: caller.pendingRecovery) { _ in alignSelectedService() }
    }

    private func alignSelectedService() {
        guard let selectedServiceID, !caller.isActive, !caller.pendingRecovery else { return }
        caller.serviceInput = String(selectedServiceID)
    }
}
