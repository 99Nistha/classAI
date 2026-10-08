import { createClient } from '@/lib/supabase/client'
import type { Chapter } from '@/types'

export async function getChapters(classId: string): Promise<Chapter[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('class_id', classId)
    .order('order', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function addChapter(classId: string, title: string): Promise<Chapter> {
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('chapters')
    .select('order')
    .eq('class_id', classId)
    .order('order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (existing?.order ?? -1) + 1

  const { data, error } = await supabase
    .from('chapters')
    .insert({ class_id: classId, title, order: nextOrder })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateChapter(id: string, title: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('chapters')
    .update({ title })
    .eq('id', id)

  if (error) throw error
}

export async function deleteChapter(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('chapters')
    .delete()
    .eq('id', id)

  if (error) throw error
}
