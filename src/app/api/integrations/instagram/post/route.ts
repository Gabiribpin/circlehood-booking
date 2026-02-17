import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { postPhoto, postStory } from '@/lib/integrations/instagram'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { postType, caption, imageUrl, link, triggerType, triggerData } = body

  // Validar campos obrigatórios
  if (!postType || !imageUrl) {
    return NextResponse.json(
      { error: 'Missing required fields: postType, imageUrl' },
      { status: 400 }
    )
  }

  // Buscar integração ativa
  const { data: integration, error: integrationError } = await supabase
    .from('integrations')
    .select('*')
    .eq('professional_id', user.id)
    .eq('type', 'instagram')
    .eq('is_active', true)
    .single()

  if (integrationError || !integration) {
    return NextResponse.json(
      { error: 'Instagram integration not found or inactive' },
      { status: 404 }
    )
  }

  try {
    let result: { id: string; permalink?: string }

    if (postType === 'story') {
      // Postar story
      result = await postStory(
        integration.instagram_user_id,
        integration.access_token,
        {
          imageUrl,
          link // Requer 10K+ followers
        }
      )
    } else {
      // Postar foto no feed
      result = await postPhoto(
        integration.instagram_user_id,
        integration.access_token,
        {
          imageUrl,
          caption
        }
      )
    }

    // Salvar post no banco
    const { data: post, error: postError } = await supabase
      .from('instagram_posts')
      .insert({
        professional_id: user.id,
        integration_id: integration.id,
        post_type: postType,
        caption,
        image_url: imageUrl,
        booking_link: link,
        instagram_media_id: result.id,
        permalink: result.permalink,
        trigger_type: triggerType || 'manual',
        trigger_data: triggerData || {},
        status: 'posted',
        posted_at: new Date().toISOString()
      })
      .select()
      .single()

    if (postError) {
      console.error('Error saving post:', postError)
      return NextResponse.json(
        { error: 'Post created on Instagram but failed to save to database' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      post,
      instagramMediaId: result.id,
      permalink: result.permalink
    })
  } catch (error: any) {
    console.error('Error posting to Instagram:', error)

    // Salvar erro no banco
    await supabase
      .from('instagram_posts')
      .insert({
        professional_id: user.id,
        integration_id: integration.id,
        post_type: postType,
        caption,
        image_url: imageUrl,
        trigger_type: triggerType || 'manual',
        trigger_data: triggerData || {},
        status: 'failed',
        error_message: error.message
      })

    return NextResponse.json(
      { error: error.message || 'Failed to post to Instagram' },
      { status: 500 }
    )
  }
}
