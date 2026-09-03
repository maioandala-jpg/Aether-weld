// /api/share-aether.js
// ══════════════════════════════════════════════════════════════════
// Endpoint de compartilhamento da AETHER — irmão do /api/share.js do
// TRAB (SEEM), adaptado para produtos.
// Serve uma página com Open Graph dinâmico (título, imagem e resumo
// do produto específico) para os "crawlers" do Facebook, WhatsApp,
// Instagram, Twitter/X etc.
//
// IMPORTANTE: os crawlers de redes sociais seguem redirecionamentos
// (inclusive <meta http-equiv="refresh">) e acabam lendo as tags da
// página de destino em vez das tags dinâmicas geradas aqui. Por isso,
// esta versão detecta se quem está acessando é um robô de rede social
// e, nesse caso, NÃO redireciona — só devolve o HTML com as tags OG
// certas. Para uma pessoa de verdade, continua redirecionando na hora
// para o site normal, já abrindo o produto certo via ?produto=TS.
//
// URL de uso:  https://aether-weld.vercel.app/api/share-aether?ts=1234567890
//
// Para a prévia funcionar de verdade no WhatsApp/Facebook, os botões
// de compartilhar do site (shareToWhatsApp/shareToX/copyLink em
// aethernoar.html) devem apontar para este endpoint em vez de
// location.href diretamente — ver nota no fim deste ficheiro.
// ══════════════════════════════════════════════════════════════════

const FB = 'https://aether-2585d-default-rtdb.firebaseio.com';
const SITE_URL = 'https://aether-weld.vercel.app';

// Valores padrão — usados como fallback caso o produto não seja
// encontrado ou não venha nenhum ts.
const PADRAO = {
  titulo: 'AETHER — A sua aura profissional',
  descricao: 'Produtos selecionados para elevar a sua imagem profissional: ferramentas, EPI, uniformes, bem-estar e mais.',
  imagem: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=1200&h=630&fit=crop&q=80'
};

// User-Agents conhecidos dos "robôs" que geram a prévia de link nas
// redes sociais. Para esses, não redirecionamos — servimos só o HTML
// com as tags certas.
const BOT_UA_REGEX = /facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|pinterest|redditbot|embedly|quora link preview|showyoubot|outbrain|vkshare|skypeuripreview|nuzzel|w3c_validator|bingpreview|google.*snippet/i;

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resumir(texto, max) {
  if (!texto) return '';
  const limpo = String(texto).replace(/\s+/g, ' ').trim();
  return limpo.length > max ? limpo.slice(0, max - 1).trim() + '…' : limpo;
}

module.exports = async function handler(req, res) {
  const ts = req.query && req.query.ts ? String(req.query.ts).trim() : '';
  const destino = ts
    ? `${SITE_URL}/?produto=${encodeURIComponent(ts)}`
    : `${SITE_URL}/`;
  // og:url precisa apontar para este mesmo endpoint (não para o site),
  // senão o Facebook trata o site como "URL canônica" e vai buscar
  // as informações lá — perdendo o título/imagem do produto.
  const urlPropria = ts
    ? `${SITE_URL}/api/share-aether?ts=${encodeURIComponent(ts)}`
    : `${SITE_URL}/api/share-aether`;

  const userAgent = String(req.headers['user-agent'] || '');
  const ehRobo = BOT_UA_REGEX.test(userAgent);

  let titulo = PADRAO.titulo;
  let descricao = PADRAO.descricao;
  let imagem = PADRAO.imagem;

  if (ts && /^\d+$/.test(ts)) {
    try {
      const url = `${FB}/produtos.json?orderBy=%22ts%22&equalTo=${ts}`;
      const r = await fetch(url);
      if (r.ok) {
        const dados = await r.json();
        const item = dados ? Object.values(dados)[0] : null;
        if (item) {
          titulo = item.titulo ? `${item.titulo} — AETHER` : titulo;
          descricao = item.subtitulo || (item.preco ? `${item.preco} · ${resumir(item.corpo, 130)}` : resumir(item.corpo, 160)) || descricao;
          if (item.imagem) {
            imagem = item.imagem;
          } else {
            // Sem imagem própria: usa a miniatura do vídeo/áudio do YouTube,
            // igual à lógica do site (aethernoar.html).
            const ytMatch = String(item.video || item.audio || '').match(
              /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/
            );
            if (ytMatch) imagem = `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
          }
        }
      }
    } catch (e) {
      // Em caso de falha, cai nos valores padrão — nunca quebra a página.
    }
  }

  // Só inclui o redirecionamento automático quando NÃO for um robô de
  // rede social — assim o robô fica na página e lê as tags OG certas,
  // enquanto uma pessoa de verdade é levada direto para o site.
  const redirecionamento = ehRobo
    ? ''
    : `<meta http-equiv="refresh" content="0; url=${escHtml(destino)}">
<script>window.location.replace(${JSON.stringify(destino)});</script>`;

  const corpoVisivel = ehRobo
    ? `<h1>${escHtml(titulo)}</h1><p>${escHtml(descricao)}</p><p><a href="${escHtml(destino)}">Ver na AETHER</a></p>`
    : `<p style="font-family:sans-serif">Redirecionando… <a href="${escHtml(destino)}">clique aqui</a> se a página não abrir automaticamente.</p>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(titulo)}</title>
<meta name="description" content="${escHtml(descricao)}">
<meta name="robots" content="noindex, follow">

<!-- Open Graph -->
<meta property="og:type" content="product">
<meta property="og:title" content="${escHtml(titulo)}">
<meta property="og:description" content="${escHtml(descricao)}">
<meta property="og:image" content="${escHtml(imagem)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${escHtml(urlPropria)}">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="AETHER">

<!-- Twitter / X Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(titulo)}">
<meta name="twitter:description" content="${escHtml(descricao)}">
<meta name="twitter:image" content="${escHtml(imagem)}">

${redirecionamento}
</head>
<body>
${corpoVisivel}
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  res.status(200).send(html);
};

// ══════════════════════════════════════════════════════════════════
// NOTA IMPORTANTE — como ligar isto ao site:
//
// Hoje (tanto na AETHER quanto no SEEM original) os botões de
// compartilhar chamam shareToWhatsApp()/shareToX()/copyLink() com
// `location.href` diretamente — ou seja, a prévia do link no WhatsApp
// mostra sempre o título/imagem genéricos do site, nunca os do produto
// aberto no momento.
//
// Para corrigir isso na AETHER, dentro de aethernoar.html troque as
// chamadas de shareToWhatsApp(titulo) / shareToX(titulo) / copyLink()
// para usarem um link do tipo:
//
//   `${SITE_URL}/api/share-aether?ts=${produto.ts}`
//
// em vez de `location.href`. Isso passa a ser necessário nos 3 pontos
// que chamam shareButtonsHTML()/bindShareButtons(): hero, card fechado
// e artigo aberto — porque cada um representa um produto diferente.
// Deixei essa mudança fora deste patch porque afeta também o
// comportamento do botão "copiar link" (o link copiado passaria a ser
// o do endpoint /api/share-aether, não a URL "limpa" do site) — avise
// se quiser que eu aplique essa troca também.
// ══════════════════════════════════════════════════════════════════
