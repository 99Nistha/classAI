import { createClient } from '@/lib/supabase/client'
import type { Lesson } from '@/types'

export async function getLessonByTopic(topicId: string): Promise<Lesson | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('lessons')
    .select('*')
    .eq('topic_id', topicId)
    .single()
  return data ?? null
}

export async function getLessonByShareToken(token: string): Promise<Lesson | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('lessons')
    .select('*')
    .eq('share_token', token)
    .single()
  return data ?? null
}

export async function publishLesson(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('lessons')
    .update({ status: 'shared' })
    .eq('id', id)
  if (error) throw error
}

export async function unpublishLesson(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('lessons')
    .update({ status: 'draft' })
    .eq('id', id)
  if (error) throw error
}
