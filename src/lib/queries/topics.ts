import { createClient } from '@/lib/supabase/client'
import type { Topic, Status } from '@/types'

export async function getTopics(chapterId: string): Promise<Topic[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('order', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function addTopic(chapterId: string, title: string): Promise<Topic> {
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('topics')
    .select('order')
    .eq('chapter_id', chapterId)
    .order('order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (existing?.order ?? -1) + 1

  const { data, error } = await supabase
    .from('topics')
    .insert({ chapter_id: chapterId, title, status: 'not_started', order: nextOrder })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateTopic(id: string, payload: Partial<Pick<Topic, 'title' | 'notes'>>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('topics')
    .update(payload)
    .eq('id', id)

  if (error) throw error
}

export async function setTopicStatus(id: string, status: Status): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('topics')
    .update({ status })
    .eq('id', id)

  if (error) throw error
}

export async function deleteTopic(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('topics')
    .delete()
    .eq('id', id)

  if (error) throw error
}
