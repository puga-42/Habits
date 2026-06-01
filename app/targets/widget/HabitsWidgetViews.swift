import SwiftUI
import WidgetKit

struct HabitsWidgetView: View {
    var entry: HabitsEntry
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        if entry.habits.isEmpty {
            emptyState
        } else {
            habitList
        }
    }

    private var emptyState: some View {
        VStack(spacing: 6) {
            Text("No habits today")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Open Habits to get started")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "habits:///(tabs)"))
    }

    private var habitList: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Spacer(minLength: 4)
            VStack(alignment: .leading, spacing: 6) {
                ForEach(entry.habits.prefix(5)) { habit in
                    HabitRow(habit: habit)
                }
                if entry.habits.count > 5 {
                    Text("+\(entry.habits.count - 5) more")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            if entry.isStale {
                Spacer(minLength: 2)
                Text("Open app to refresh")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(URL(string: "habits:///(tabs)"))
    }

    private var header: some View {
        HStack {
            Text("Today")
                .font(.headline)
            Spacer()
            Text(entry.date, format: .dateTime.weekday(.wide).month(.abbreviated).day())
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

struct HabitRow: View {
    let habit: WidgetHabit

    var body: some View {
        HStack(spacing: 8) {
            if let icon = habit.icon {
                Text(icon)
                    .font(.system(size: 14))
                    .frame(width: 20)
            } else {
                Circle()
                    .fill(habitColor)
                    .frame(width: 10, height: 10)
                    .frame(width: 20)
            }

            Text(habit.title)
                .font(.subheadline)
                .lineLimit(1)
                .strikethrough(habit.isCompleted, color: .secondary)
                .foregroundStyle(habit.isCompleted ? .secondary : .primary)

            Spacer()

            if habit.isFlex, let target = habit.targetCount, let count = habit.completedCount {
                Text("\(count)/\(target)")
                    .font(.caption)
                    .foregroundStyle(habit.isCompleted ? .green : .secondary)
            }

            Image(systemName: habit.isCompleted ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 16))
                .foregroundStyle(habit.isCompleted ? .green : .secondary)
        }
    }

    private var habitColor: Color {
        guard let hex = habit.color else { return .gray }
        return Color(hex: hex)
    }
}

extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var rgb: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
