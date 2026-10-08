export type Status = 'not_started' | 'teaching' | 'covered'
export type LessonStatus = 'draft' | 'shared'

export interface Teacher {
  id: string
  name: string | null
  email: string
  created_at: string
}

export interface Class {
  id: string
  teacher_id: string
  name: string
  grade: number
  subject: string
  archived: boolean
  created_at: string
}

export interface Chapter {
  id: string
  class_id: string
  title: string
  order: number
  created_at: string
}

export interface Topic {
  id: string
  chapter_id: string
  title: string
  notes: string | null
  status: Status
  order: number
  created_at: string
}

export interface Lesson {
  id: string
  topic_id: string
  teacher_id: string
  instructions: string | null
  html_url: string | null
  share_token: string
  status: LessonStatus
  created_at: string
}
