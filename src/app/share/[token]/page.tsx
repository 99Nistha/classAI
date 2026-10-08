import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ token: string }>
}

export default async function SharePage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  const { data: lesson } = await supabase
    .from('lessons')
    .select('*')
    .eq('share_token', token)
    .single()

  if (!lesson || !lesson.html_url) {
    notFound()
  }

  // html_url stores the full lesson HTML inline
  const html = lesson.html_url as string

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      {/* We render the lesson HTML in an iframe for sandboxing */}
      <iframe
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="ClassAI Lesson"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
