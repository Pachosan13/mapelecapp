/** @type {import('next').NextConfig} */

// Identidad del build, para invalidar el caché del service worker en CADA deploy.
// Antes la versión del SW se subía A MANO (`const VERSION = "semco-v3"` en public/sw.js)
// con un comentario que pedía acordarse en cada cambio de la pantalla del técnico.
// Se olvidó el 20-jul (el commit 31f2632 tocó app/tech/visits/[id]/page.tsx sin subirla)
// y las tablets se quedaron sirviendo el HTML cacheado del 17-jul. Metadata escrita a
// mano se pudre: ahora se deriva del commit y nadie tiene que acordarse.
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || // Vercel: determinista por deploy
  String(Date.now()); // local: basta con que cambie entre builds

const nextConfig = {
  experimental: {
    serverActions: {
      // Las fotos de equipo que sube el gerente (`ops/buildings/.../equipment/.../edit`)
      // viajan por un server action, y Next los limita a 1 MB por defecto. Cualquier
      // foto de celular pasaba de ahí y fallaba con un error opaco. 5 MB deja pasar
      // el tope real de la app (4 MB, ver lib/media/service) más el sobre multipart.
      bodySizeLimit: "5mb",
    },
  },
  env: {
    // Se inlinea en el bundle del cliente al construir. Lo consume ServiceWorkerRegister
    // para registrar `/sw.js?v=<buildId>`.
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
};

module.exports = nextConfig;
