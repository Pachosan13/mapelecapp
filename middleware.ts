import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  type AuthErrLike = { status?: number; name?: string; message?: string };
  let user: Awaited<
    ReturnType<typeof supabase.auth.getUser>
  >["data"]["user"] = null;
  let authError: AuthErrLike | null = null;
  try {
    const res = await supabase.auth.getUser();
    user = res.data.user;
    authError = res.error;
  } catch (e) {
    authError = e as AuthErrLike;
  }

  const pathname = request.nextUrl.pathname;
  const isAuthenticated = !!user;
  const userId = user?.id || "none";

  console.log("[middleware] pathname:", pathname);
  console.log("[middleware] isAuthenticated:", isAuthenticated ? "yes" : "no");
  console.log("[middleware] user id:", userId);

  // API routes should never be redirected to HTML pages.
  if (pathname.startsWith("/api/reports/")) {
    return response;
  }

  if (pathname.startsWith("/api/")) {
    return response;
  }

  // Public route: /login - always allow
  if (pathname === "/login") {
    return response;
  }

  // Protected routes - require authentication
  if (!user) {
    // Señal débil en campo (sótano/foso): getUser() valida el token contra el servidor
    // de Auth por RED. Si esa llamada falla por conexión —no porque el token sea
    // inválido— NO botamos al técnico al login mientras traiga su cookie de sesión.
    // La página revalida server-side; una sesión de verdad expirada (401/400) sí cae.
    const isNetworkError =
      !!authError &&
      (authError.status === undefined ||
        authError.status >= 500 ||
        /fetch|network|retry|timeout/i.test(
          `${authError.name ?? ""} ${authError.message ?? ""}`
        ));
    const hasAuthCookie = request.cookies
      .getAll()
      .some((c) => /auth-token/.test(c.name));
    if (isNetworkError && hasAuthCookie) {
      return response;
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  // User is authenticated - allow request
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sw.js / manifest / offline.html (PWA shell — deben servirse sin auth,
     *   si no el service worker no registra ni carga el manifest)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
