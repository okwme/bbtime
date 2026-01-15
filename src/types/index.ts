export type ActivityType = 'sleeping' | 'awake' | 'eating'

export interface ActivityEntry {
  id: string
  type: ActivityType
  startTime: Date
  endTime: Date | null
}

export interface DayData {
  date: string // YYYY-MM-DD format
  entries: ActivityEntry[]
}
