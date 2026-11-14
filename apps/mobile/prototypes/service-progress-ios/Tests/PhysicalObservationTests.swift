import XCTest

// Metadata-only first physical pass. Raw xcresult/logs remain private local artifacts.
// No screenshot attachments, permission-button taps or accessibility-tree dumps.
final class PhysicalObservationTests: XCTestCase {
    func testSyntheticTerminatedObservation() throws {
        guard ProcessInfo.processInfo.environment["SERVICE_PROGRESS_PRIVATE_OBSERVER"] == "metadata-only" else {
            throw XCTSkip("Use the reviewed private observer xctestrun configuration.")
        }
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        defer {
            // Relaunch cleans up only this isolated app's Activities and resets consent.
            app.launch()
        }
        let consent = app.descendants(matching: .any).matching(identifier: "disclosure").firstMatch
        XCTAssertTrue(consent.waitForExistence(timeout: 20), "Synthetic disclosure control unavailable")
        XCTAssertEqual(app.staticTexts["disclosureState"].label,
                       "Public Lock Screen disclosure for service 42: OFF")
        consent.tap()
        XCTAssertEqual(app.staticTexts["disclosureState"].label,
                       "Public Lock Screen disclosure for service 42: ON")
        app.buttons["Start local activity"].tap()
        guard app.staticTexts["status"].label == "Local activity requested — staleDate set to +60s" else {
            // Do not dump a UI hierarchy or arbitrary error/permission text.
            throw XCTSkip("Synthetic Activity request unavailable; inspect only the isolated app locally.")
        }
        // This value is produced by our synthetic app, never by a system/private surface.
        let metadata = app.staticTexts["status"].value as? String ?? "unavailable"
        print("PHYSICAL_SYNTHETIC_REQUEST \(metadata)")
        let started = Date()
        XCUIDevice.shared.press(.home)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.01))
            .press(forDuration: 0.1, thenDragTo: springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.8)))
        // Deliberately do not tap Allow/Always Allow: any actual permission prerequisite
        // must first be identified as belonging to this isolated prototype.
        func sample(_ phase: String) -> Bool {
            let title = "SYNTHETIC PUBLIC SERVICE 42"
            // WidgetKit may expose a combined accessibility element rather than
            // StaticText children. Query only our fixed strings, never dump the tree.
            func containsSyntheticLabel(_ value: String) -> Bool {
                springboard.descendants(matching: .any)
                    .matching(NSPredicate(format: "label CONTAINS %@", value)).firstMatch.exists
            }
            let titleVisible = containsSyntheticLabel(title)
            let staleVisible = containsSyntheticLabel("Stale — open public parts")
            let reportedVisible = containsSyntheticLabel("Last reported part")
            print("PHYSICAL_SYNTHETIC_SAMPLE phase=\(phase) elapsed=\(Int(Date().timeIntervalSince(started))) title=\(titleVisible) staleLabel=\(staleVisible) lastReportedLabel=\(reportedVisible)")
            return titleVisible
        }
        guard sample("background") else {
            throw XCTSkip("Synthetic system card not observable; permission or accessibility state is inconclusive.")
        }
        app.terminate() // Deliberate XCTest termination, NOT OS eviction or user force-quit.
        _ = sample("terminated")
        for deadline in [75.0, 180.0] {
            let remaining = max(0, deadline - Date().timeIntervalSince(started))
            let observation = expectation(description: "Synthetic native observation")
            DispatchQueue.main.asyncAfter(deadline: .now() + remaining) { observation.fulfill() }
            wait(for: [observation], timeout: remaining + 15)
            _ = sample("terminated-\(Int(deadline))s")
        }
        // Metadata queries are observations, not visual captures. Missing labels or
        // inaccessible combined widget semantics do not establish stale/fresh rendering.
        print("PHYSICAL_SYNTHETIC_COMPLETE metadata-only; no APNs, physical lock, OS eviction, force-quit or visual-deadline proof")
    }
}
