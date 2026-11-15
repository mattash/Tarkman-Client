import ActivityKit
import CoreFoundation
import React
import SwiftUI
import UIKit

// Compiled into the explicitly isolated product-development target ONLY.
// Registration never constructs a caller, starts HTTP or requests an Activity.
@objc(TarkmanServiceProgress)
final class TarkmanServiceProgress: NSObject {
    @MainActor private static var caller: ServiceRemoteExperimentController?
    @MainActor private static weak var presentation: UIViewController?
    @MainActor private static var presenting = false

    @objc static func requiresMainQueueSetup() -> Bool { false }

    // A presentation is not disclosure, a follow, registration or delivery.
    @objc(presentService:readerAPI:resolver:rejecter:)
    func presentService(_ serviceID: NSNumber, readerAPI: String,
                        resolver: @escaping RCTPromiseResolveBlock,
                        rejecter: @escaping RCTPromiseRejectBlock) {
        Task { @MainActor in
            let number = serviceID.doubleValue
            guard CFGetTypeID(serviceID) != CFBooleanGetTypeID(), number.isFinite,
                  number.rounded() == number, number > 0, number <= 9_007_199_254_740_991,
                  Bundle.main.bundleIdentifier == "app.tarkman.progressprototype",
                  let configuration = try? ServiceRemoteExperimentConfiguration(info: Bundle.main.infoDictionary ?? [:]),
                  configuration.remoteEnabled,
                  configuration.admitsReaderAPI(readerAPI, simulatorAvailable: ServiceSimulatorFixture.available),
                  UIApplication.shared.applicationState == .active,
                  Self.presentation == nil, !Self.presenting,
                  let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
                    .first(where: { $0.activationState == .foregroundActive }),
                  let root = scene.windows.first(where: \.isKeyWindow)?.rootViewController else {
                resolver("unavailable")
                return
            }
            Self.presenting = true
            defer { Self.presenting = false }
            let selectedID = Int(number)
            let controller: ServiceRemoteExperimentController
            if let existing = Self.caller { controller = existing }
            else {
                controller = ServiceRemoteExperimentController()
                Self.caller = controller
                // Recovery never reconstructs a follow or restores disclosure.
                for activity in Activity<ServicePublicationIdentity>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
                for activity in Activity<ServiceAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
            guard UIApplication.shared.applicationState == .active,
                  scene.activationState == .foregroundActive else { resolver("unavailable"); return }
            if !controller.isActive && !controller.pendingRecovery {
                controller.disclosed = false
                controller.serviceInput = String(selectedID)
            }
            var presenter = root
            while let next = presenter.presentedViewController { presenter = next }
            guard !presenter.isBeingDismissed, presenter.viewIfLoaded?.window != nil else {
                resolver("unavailable")
                return
            }
            let host = UIHostingController(rootView: ServiceProgressProductSheet(caller: controller, selectedID: selectedID))
            host.modalPresentationStyle = .pageSheet
            Self.presentation = host
            presenter.present(host, animated: true) { resolver("presented") }
        }
    }
}

private struct ServiceProgressProductSheet: View {
    let caller: ServiceRemoteExperimentController
    let selectedID: Int
    @Environment(\.dismiss) private var dismiss
    @State private var active = false

    var body: some View {
        NavigationStack {
            Form {
                ServiceRemoteExperimentView(remoteActive: $active, ready: true,
                    controller: caller, selectedServiceID: selectedID) {}
            }
            .navigationTitle(Text("remoteSection"))
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("remoteDone") { dismiss() } }
            }
        }
    }
}
