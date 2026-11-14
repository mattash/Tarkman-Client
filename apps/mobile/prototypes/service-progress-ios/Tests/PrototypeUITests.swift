import XCTest

final class PrototypeUITests: XCTestCase {
    override func setUpWithError() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Full-screen captures and broad system permission queries are owned-simulator-only.")
        #endif
    }

    func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    // Same scenario for the real pre-v1 and v1 renderer comparison on an owned simulator.
    func testMatchedNativeCard() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        let consent = app.descendants(matching: .any).matching(identifier: "disclosure").firstMatch
        XCTAssertTrue(consent.waitForExistence(timeout: 20))
        XCTAssertEqual(app.staticTexts["disclosureState"].label, "Public Lock Screen disclosure for service 42: OFF")
        capture("matched-disclosure-off")
        consent.tap()
        app.buttons["Start local activity"].tap()
        XCTAssertEqual(app.staticTexts["status"].label, "Local activity requested — staleDate set to +60s")
        app.buttons["Advance local part"].tap() // Same occurrence 12, Choir, 2/3 in both revisions.
        capture("matched-foreground-choir")
        XCUIDevice.shared.press(.home)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.01))
            .press(forDuration: 0.1, thenDragTo: springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.8)))
        let card = springboard.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", "SYNTHETIC PUBLIC SERVICE 42")).firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 20), "Synthetic native card did not render")
        let choir = springboard.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", "Choir")).firstMatch
        XCTAssertTrue(choir.waitForExistence(timeout: 10), "Native role must be localized, not a wire key")
        capture("matched-system-choir")
        app.terminate()
    }

    func testV1SemanticControls() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        let consent = app.descendants(matching: .any).matching(identifier: "disclosure").firstMatch
        XCTAssertTrue(consent.waitForExistence(timeout: 20))
        consent.tap()
        app.buttons["Start local activity"].tap()
        XCTAssertEqual(app.staticTexts["status"].label, "Local activity requested — staleDate set to +60s")
        func tap(_ label: String) {
            let button = app.buttons[label]
            if !button.isHittable { app.swipeUp() }
            button.tap()
        }
        func expectPreview(_ value: String) {
            let preview = app.descendants(matching: .any).matching(identifier: "service-publication-card").firstMatch
            let expected = expectation(for: NSPredicate(format: "label CONTAINS %@", value), evaluatedWith: preview)
            wait(for: [expected], timeout: 10)
        }
        tap("Use unknown-total fixture")
        expectPreview("Last reported progress unknown")
        capture("v1-unknown-total")
        tap("Use empty-manifest fixture")
        expectPreview("No parts in the reported service")
        capture("v1-empty-manifest")
        tap("Restore ordered fixture")
        expectPreview("1/3")
        tap("Pause locally")
        expectPreview("Paused")
        capture("v1-paused")
        tap("Delete synthetic service")
        expectPreview("Service removed")
        let ended = expectation(for: NSPredicate(format: "label == %@", "No activity — disclosure off / removed"),
                                evaluatedWith: app.staticTexts["status"])
        wait(for: [ended], timeout: 10)
        capture("v1-deleted-cleared")
        app.terminate()
    }

    func testDisclosureAndTerminatedStaleness() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        let consent = app.descendants(matching: .any).matching(identifier: "disclosure").firstMatch
        XCTAssertTrue(consent.waitForExistence(timeout: 20))
        XCTAssertEqual(app.staticTexts["disclosureState"].label, "Public Lock Screen disclosure for service 42: OFF")
        capture("01-same-revision-pre-opt-in")
        consent.tap()
        XCTAssertEqual(app.staticTexts["disclosureState"].label, "Public Lock Screen disclosure for service 42: ON")
        app.buttons["Start local activity"].tap()
        capture("02-foreground-after-start-request")
        print("PROTOTYPE UI status: \(app.staticTexts["status"].label)")
        print("PROTOTYPE returned request metadata: \(app.staticTexts["status"].value ?? "unavailable")")
        print(app.debugDescription)
        XCTAssertEqual(app.staticTexts["status"].label, "Local activity requested — staleDate set to +60s")
        XCUIDevice.shared.press(.home)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        // System Notification Center presents the Lock Screen activity surface.
        let top = springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.01))
        top.press(forDuration: 0.1, thenDragTo: springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.8)))
        // First use also requires genuine iOS permission on this owned simulator.
        // This occurs only AFTER the explicit per-service in-app disclosure consent.
        let systemAllow = springboard.buttons["Allow"]
        if systemAllow.waitForExistence(timeout: 5) { systemAllow.tap() }
        let systemAlwaysAllow = springboard.buttons["Always Allow"]
        if systemAlwaysAllow.waitForExistence(timeout: 3) { systemAlwaysAllow.tap() }
        capture("03-background-system-surface-active")
        app.terminate() // Deliberate simulator process termination, not OS eviction.
        capture("04-terminated-system-surface-active")
        let expiry = expectation(description: "Observe system after 75 seconds without app relaunch")
        DispatchQueue.main.asyncAfter(deadline: .now() + 75) { expiry.fulfill() }
        wait(for: [expiry], timeout: 85)
        capture("05-terminated-system-surface-after-75s")
        let later = expectation(description: "Observe eventual native stale rendering without app relaunch")
        DispatchQueue.main.asyncAfter(deadline: .now() + 105) { later.fulfill() }
        wait(for: [later], timeout: 115)
        capture("06-terminated-system-surface-after-180s")
    }

    func testZBackgroundOnlyExpiry() {
        continueAfterFailure = false
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        func openSurface() {
            XCUIDevice.shared.press(.home)
            springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.01))
                .press(forDuration: 0.1, thenDragTo: springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.8)))
        }
        // Observe an existing terminated activity after a genuine system-surface reopen.
        // Do NOT launch the app before this capture (launch intentionally removes old activities).
        openSurface()
        capture("06-existing-terminated-activity-surface-reopened")
        let app = XCUIApplication()
        app.launch()
        let consent = app.descendants(matching: .any).matching(identifier: "disclosure").firstMatch
        XCTAssertTrue(consent.waitForExistence(timeout: 20))
        XCTAssertEqual(app.staticTexts["disclosureState"].label, "Public Lock Screen disclosure for service 42: OFF")
        consent.tap()
        XCTAssertEqual(app.staticTexts["disclosureState"].label, "Public Lock Screen disclosure for service 42: ON")
        app.buttons["Start local activity"].tap()
        XCTAssertEqual(app.staticTexts["status"].label, "Local activity requested — staleDate set to +60s")
        print("PROTOTYPE background request metadata: \(app.staticTexts["status"].value ?? "unavailable")")
        openSurface()
        let allow = springboard.buttons["Allow"]
        if allow.waitForExistence(timeout: 3) { allow.tap() }
        let alwaysAllow = springboard.buttons["Always Allow"]
        if alwaysAllow.waitForExistence(timeout: 3) { alwaysAllow.tap() }
        capture("07-background-only-before-expiry")
        let expiry = expectation(description: "Observe background-only activity after 75 seconds")
        DispatchQueue.main.asyncAfter(deadline: .now() + 75) { expiry.fulfill() }
        wait(for: [expiry], timeout: 85)
        capture("08-background-only-after-75s")
        openSurface()
        capture("09-background-only-after-expiry-surface-reopened")
        app.terminate()
        capture("10-background-expired-then-terminated")
    }
}
