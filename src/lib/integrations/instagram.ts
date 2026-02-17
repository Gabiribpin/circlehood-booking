/**
 * Instagram Integration Library
 * Gerencia posts automatizados no Instagram via Meta Graph API
 */

const INSTAGRAM_API_VERSION = 'v18.0'
const INSTAGRAM_GRAPH_API = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`

export interface InstagramConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface InstagramTokens {
  accessToken: string
  userId: string
  expiresAt?: Date
}

export interface InstagramMediaParams {
  imageUrl: string
  caption?: string
  locationId?: string
  isCarousel?: boolean
}

export interface InstagramStoryParams {
  imageUrl: string
  link?: string // Requer 10K+ followers
}

/**
 * Obter URL de autorização OAuth
 */
export function getAuthorizationUrl(config: InstagramConfig): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'instagram_basic,instagram_content_publish',
    response_type: 'code'
  })

  return `https://api.instagram.com/oauth/authorize?${params.toString()}`
}

/**
 * Trocar código de autorização por access token
 */
export async function exchangeCodeForToken(
  code: string,
  config: InstagramConfig
): Promise<{ accessToken: string; userId: string }> {
  const formData = new FormData()
  formData.append('client_id', config.clientId)
  formData.append('client_secret', config.clientSecret)
  formData.append('grant_type', 'authorization_code')
  formData.append('redirect_uri', config.redirectUri)
  formData.append('code', code)

  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Instagram OAuth error: ${error.error_message}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    userId: data.user_id
  }
}

/**
 * Trocar Short-Lived Token por Long-Lived Token (60 dias)
 */
export async function getLongLivedToken(
  shortToken: string,
  clientSecret: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: clientSecret,
    access_token: shortToken
  })

  const response = await fetch(`${INSTAGRAM_GRAPH_API}/access_token?${params.toString()}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to get long-lived token: ${error.error.message}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in // 60 dias em segundos
  }
}

/**
 * Renovar Long-Lived Token (fazer antes de expirar)
 */
export async function refreshLongLivedToken(
  accessToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: accessToken
  })

  const response = await fetch(`${INSTAGRAM_GRAPH_API}/refresh_access_token?${params.toString()}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to refresh token: ${error.error.message}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in
  }
}

/**
 * Criar container de mídia (passo 1 de publicação)
 */
export async function createMediaContainer(
  userId: string,
  accessToken: string,
  params: InstagramMediaParams
): Promise<string> {
  const body: any = {
    image_url: params.imageUrl,
    access_token: accessToken
  }

  if (params.caption) {
    body.caption = params.caption
  }

  if (params.locationId) {
    body.location_id = params.locationId
  }

  const response = await fetch(`${INSTAGRAM_GRAPH_API}/${userId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to create media container: ${error.error.message}`)
  }

  const data = await response.json()
  return data.id // creation_id
}

/**
 * Publicar mídia (passo 2 de publicação)
 */
export async function publishMedia(
  userId: string,
  accessToken: string,
  creationId: string
): Promise<{ id: string; permalink?: string }> {
  const body = {
    creation_id: creationId,
    access_token: accessToken
  }

  const response = await fetch(`${INSTAGRAM_GRAPH_API}/${userId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to publish media: ${error.error.message}`)
  }

  const data = await response.json()

  // Buscar permalink
  const mediaInfo = await getMediaInfo(data.id, accessToken)

  return {
    id: data.id,
    permalink: mediaInfo.permalink
  }
}

/**
 * Postar foto no feed (método combinado)
 */
export async function postPhoto(
  userId: string,
  accessToken: string,
  params: InstagramMediaParams
): Promise<{ id: string; permalink?: string }> {
  const creationId = await createMediaContainer(userId, accessToken, params)

  // Aguardar processamento da imagem (pode levar alguns segundos)
  await new Promise(resolve => setTimeout(resolve, 5000))

  return await publishMedia(userId, accessToken, creationId)
}

/**
 * Postar story
 */
export async function postStory(
  userId: string,
  accessToken: string,
  params: InstagramStoryParams
): Promise<{ id: string }> {
  const body: any = {
    image_url: params.imageUrl,
    media_type: 'STORIES',
    access_token: accessToken
  }

  // Link swipe-up (requer 10K+ followers)
  if (params.link) {
    body.link = params.link
  }

  const response = await fetch(`${INSTAGRAM_GRAPH_API}/${userId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to create story: ${error.error.message}`)
  }

  const data = await response.json()
  const creationId = data.id

  // Aguardar processamento
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Publicar story
  const published = await publishMedia(userId, accessToken, creationId)

  return { id: published.id }
}

/**
 * Obter informações de uma mídia publicada
 */
export async function getMediaInfo(
  mediaId: string,
  accessToken: string
): Promise<any> {
  const params = new URLSearchParams({
    fields: 'id,media_type,media_url,permalink,caption,timestamp,like_count,comments_count',
    access_token: accessToken
  })

  const response = await fetch(`${INSTAGRAM_GRAPH_API}/${mediaId}?${params.toString()}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to get media info: ${error.error.message}`)
  }

  return await response.json()
}

/**
 * Obter insights de uma mídia (estatísticas)
 */
export async function getMediaInsights(
  mediaId: string,
  accessToken: string
): Promise<{
  reach: number
  impressions: number
  engagement: number
  saved: number
}> {
  const params = new URLSearchParams({
    metric: 'impressions,reach,engagement,saved',
    access_token: accessToken
  })

  const response = await fetch(`${INSTAGRAM_GRAPH_API}/${mediaId}/insights?${params.toString()}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to get media insights: ${error.error.message}`)
  }

  const data = await response.json()

  const insights: any = {}
  data.data.forEach((metric: any) => {
    insights[metric.name] = metric.values[0].value
  })

  return {
    reach: insights.reach || 0,
    impressions: insights.impressions || 0,
    engagement: insights.engagement || 0,
    saved: insights.saved || 0
  }
}

/**
 * Obter perfil do usuário
 */
export async function getUserProfile(
  userId: string,
  accessToken: string
): Promise<{
  id: string
  username: string
  accountType: string
  mediaCount: number
}> {
  const params = new URLSearchParams({
    fields: 'id,username,account_type,media_count',
    access_token: accessToken
  })

  const response = await fetch(`${INSTAGRAM_GRAPH_API}/${userId}?${params.toString()}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to get user profile: ${error.error.message}`)
  }

  const data = await response.json()

  return {
    id: data.id,
    username: data.username,
    accountType: data.account_type,
    mediaCount: data.media_count
  }
}

/**
 * Gerar imagem para vacancy story
 */
export function generateVacancyStoryUrl(params: {
  serviceName: string
  time: string
  professionalName: string
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const queryParams = new URLSearchParams({
    service: params.serviceName,
    time: params.time,
    professional: params.professionalName
  })

  return `${baseUrl}/api/og/vacancy-story?${queryParams.toString()}`
}

/**
 * Validar se conta é Business ou Creator (necessário para Instagram API)
 */
export function isBusinessAccount(accountType: string): boolean {
  return accountType === 'BUSINESS' || accountType === 'CREATOR'
}

/**
 * Verificar se token está próximo de expirar (renovar se faltar menos de 7 dias)
 */
export function shouldRefreshToken(expiresAt: Date): boolean {
  const now = new Date()
  const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return daysUntilExpiry < 7
}
