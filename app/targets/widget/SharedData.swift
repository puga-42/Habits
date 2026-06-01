import Foundation

struct WidgetPayload: Codable {
    let updatedAt: String
    let habits: [WidgetHabit]
}

struct WidgetHabit: Codable, Identifiable {
    let id: String
    let title: String
    let icon: String?
    let color: String?
    let kind: String
    let isCompleted: Bool
    let targetCount: Int?
    let completedCount: Int?

    var isFlex: Bool { kind == "flex" }
}

enum SharedDataReader {
    static let appGroup = "group.com.joshbernd.habits"
    static let widgetDataKey = "widgetData"

    static func loadPayload() -> WidgetPayload? {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let jsonString = defaults.string(forKey: widgetDataKey),
              let data = jsonString.data(using: .utf8)
        else { return nil }
        return try? JSONDecoder().decode(WidgetPayload.self, from: data)
    }

    static func isStale(_ payload: WidgetPayload) -> Bool {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let updated = formatter.date(from: payload.updatedAt) else { return true }
        return Date().timeIntervalSince(updated) > 86400
    }
}
