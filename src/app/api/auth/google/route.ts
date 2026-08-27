import { NextResponse } from 'next/server';
import { callbackUrl, startGoogleLogin } from '@/lib/auth/google';
import { googleIsConfigured } from '@/lib/auth/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Arranca el acceso con Google y guarda los secretos de un solo uso. */
export async function GET(request: Request) {
  if (!googleIsConfigured()) {
    return NextResponse.redirect(new URL('/acceso?error=google-no-configurado', request.url));
  }

  const redirectUri = callbackUrl(request);
  const { url, state, nonce, verifier } = startGoogleLogin(redirectUri);

  const response = NextResponse.redirect(url);
  const secure = process.env.NODE_ENV === 'production';

  // Estos tres valores no pueden viajar en la URL: se guardan en cookies que
  // el navegador no puede leer y que caducan en diez minutos.
  const options = {
    httpOnly: true,
    secure,
    // «lax» permite que la cookie vuelva con la redirección de Google, que es
    // una navegación de nivel superior; «strict» la bloquearía.
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600,
  };

  response.cookies.set('suma_oauth_state', state, options);
  response.cookies.set('suma_oauth_nonce', nonce, options);
  response.cookies.set('suma_oauth_verifier', verifier, options);

  return response;
}
