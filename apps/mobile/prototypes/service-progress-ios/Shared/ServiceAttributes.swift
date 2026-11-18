import ActivityKit
import Foundation

struct ServiceAttributes: ActivityAttributes {
    typealias ContentState = ServiceContentState
    let serviceID: Int
    // Immutable, distinct occurrences; not production part identifiers.
    static let occurrenceIDs = [11, 12, 13]
    static let roles = ["reader", "choir", "reader"]
    static let publicURL = URL(string: "https://web.tarkman.app/sessions/42/parts")!
}
