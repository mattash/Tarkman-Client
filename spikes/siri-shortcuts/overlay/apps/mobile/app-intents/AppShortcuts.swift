import AppIntents

/// Required string ID is collected as a follow-up, not interpolated into a phrase.
struct AppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: OpenLiturgyIntent(),
      phrases: ["Open a liturgy in \(.applicationName)"],
      shortTitle: "Open Liturgy",
      systemImageName: "book"
    )
  }
}
