import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const service = searchParams.get('service') || 'Serviço'
  const time = searchParams.get('time') || '10:00'
  const professional = searchParams.get('professional') || 'CircleHood'

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative'
        }}
      >
        {/* Efeito de fundo */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 70%)',
            opacity: 0.5
          }}
        />

        {/* Conteúdo */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px',
            textAlign: 'center',
            zIndex: 1
          }}
        >
          {/* Ícone */}
          <div
            style={{
              fontSize: 120,
              marginBottom: 40
            }}
          >
            🎉
          </div>

          {/* Título */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 'bold',
              color: 'white',
              marginBottom: 30,
              lineHeight: 1.2
            }}
          >
            Vaga Disponível!
          </div>

          {/* Serviço */}
          <div
            style={{
              fontSize: 54,
              color: 'rgba(255,255,255,0.95)',
              marginBottom: 20,
              fontWeight: 600
            }}
          >
            {service}
          </div>

          {/* Horário */}
          <div
            style={{
              fontSize: 64,
              color: 'white',
              fontWeight: 'bold',
              backgroundColor: 'rgba(255,255,255,0.2)',
              padding: '20px 50px',
              borderRadius: 20,
              marginBottom: 40
            }}
          >
            {time}
          </div>

          {/* CTA */}
          <div
            style={{
              fontSize: 42,
              color: 'rgba(255,255,255,0.9)',
              marginBottom: 20
            }}
          >
            Link na bio para agendar! 👆
          </div>

          {/* Profissional */}
          <div
            style={{
              fontSize: 36,
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 500
            }}
          >
            {professional}
          </div>
        </div>

        {/* Logo no canto */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            right: 40,
            fontSize: 32,
            color: 'rgba(255,255,255,0.6)',
            fontWeight: 600
          }}
        >
          CircleHood
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920 // Instagram Story size
    }
  )
}
