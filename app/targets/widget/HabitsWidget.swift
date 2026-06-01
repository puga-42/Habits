import WidgetKit
import SwiftUI

struct HabitsEntry: TimelineEntry {
    let date: Date
    let habits: [WidgetHabit]
    let isStale: Bool
}

struct HabitsProvider: TimelineProvider {
    func placeholder(in context: Context) -> HabitsEntry {
        HabitsEntry(
            date: Date(),
            habits: [
                WidgetHabit(id: "1", title: "Meditate", icon: "🧘", color: "#4A90D9",
                            kind: "scheduled", isCompleted: true, targetCount: nil, completedCount: nil),
                WidgetHabit(id: "2", title: "Read", icon: "📖", color: "#50C878",
                            kind: "scheduled", isCompleted: false, targetCount: nil, completedCount: nil),
                WidgetHabit(id: "3", title: "Exercise", icon: "🏋️", color: "#E85D75",
                            kind: "flex", isCompleted: false, targetCount: 3, completedCount: 1),
            ],
            isStale: false
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (HabitsEntry) -> Void) {
        let entry = loadEntry()
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HabitsEntry>) -> Void) {
        let entry = loadEntry()
        let midnight = Calendar.current.startOfDay(
            for: Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        )
        let timeline = Timeline(entries: [entry], policy: .after(midnight))
        completion(timeline)
    }

    private func loadEntry() -> HabitsEntry {
        guard let payload = SharedDataReader.loadPayload() else {
            return HabitsEntry(date: Date(), habits: [], isStale: false)
        }
        return HabitsEntry(
            date: Date(),
            habits: payload.habits,
            isStale: SharedDataReader.isStale(payload)
        )
    }
}

struct HabitsWidget: Widget {
    let kind: String = "HabitsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitsProvider()) { entry in
            HabitsWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Today's Habits")
        .description("See your habits and progress for today.")
        .supportedFamilies([.systemMedium])
    }
}

#Preview(as: .systemMedium) {
    HabitsWidget()
} timeline: {
    HabitsEntry(
        date: .now,
        habits: [
            WidgetHabit(id: "1", title: "Meditate", icon: "🧘", color: "#4A90D9",
                        kind: "scheduled", isCompleted: true, targetCount: nil, completedCount: nil),
            WidgetHabit(id: "2", title: "Read", icon: "📖", color: "#50C878",
                        kind: "scheduled", isCompleted: false, targetCount: nil, completedCount: nil),
            WidgetHabit(id: "3", title: "Exercise", icon: "🏋️", color: "#E85D75",
                        kind: "flex", isCompleted: false, targetCount: 3, completedCount: 1),
        ],
        isStale: false
    )
}
