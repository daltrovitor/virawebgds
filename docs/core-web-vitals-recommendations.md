## Core Web Vitals - Recomendações práticas para Next.js

- LCP (Largest Contentful Paint):
  - Otimize imagens: use `next/image`, defina `priority` para a imagem principal e gere formatos `webp`/`avif`.
  - Prefetch critical CSS/fonts: use `<link rel="preload" as="font" ...>` para fontes usadas no LCP.
  - Server-side rendering: mantenha HTML mínimo para o LCP e adie scripts não críticos.

- CLS (Cumulative Layout Shift):
  - Defina `width`/`height` para imagens ou use CSS aspect-ratio boxes.
  - Reserve espaço para ads/iframes com CSS.
  - Evite injetar conteúdo acima do scroll sem dimensão.

- FID / INP (First Input Delay / Interaction to Next Paint):
  - Divida o JavaScript: código cliente pesado deve ser carregado via dynamic imports com `{ ssr: false }` quando possível.
  - Use `useEffect` para inicializar bibliotecas não essenciais.
  - Remova polyfills desnecessários e use HTTP/2 or HTTP/3 on hosting.

Ferramentas e comandos rápidos:
```
# Rodar Lighthouse localmente via Chrome
npx lhci autorun --upload.target=filesystem

# Executar audit do Next.js build
npm run build && npx next build && npx next lint
```
