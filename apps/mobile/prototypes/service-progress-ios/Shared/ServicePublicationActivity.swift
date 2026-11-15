import ActivityKit

// Compiled native binding for the new versioned wire type. No Activity request,
// token subscription, renderer or registration transport is enabled by this type.
extension ServicePublicationIdentity: ActivityAttributes {
    typealias ContentState = ServicePublicationV1
}
