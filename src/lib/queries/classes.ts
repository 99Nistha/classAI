import { createClient } from '@/lib/supabase/client'
import type { Class } from '@/types'

export async function getClasses(): Promise<Class[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function addClass(payload: Pick<Class, 'name' | 'grade' | 'subject'>): Promise<Class> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('classes')
    .insert({ ...payload, teacher_id: user.id, archived: false })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateClass(id: string, payload: Partial<Pick<Class, 'name' | 'grade' | 'subject'>>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('classes')
    .update(payload)
    .eq('id', id)

  if (error) throw error
}

export async function archiveClass(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('classes')
    .update({ archived: true })
    .eq('id', id)

  if (error) throw error
}

export async function deleteClass(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', id)

  if (error) throw error
}
