/**
 * Normalização dos dados que chegam do WhatsApp (Meta Cloud API).
 *
 * O `wa_id` vem em E.164 sem o "+" (ex.: 5511987654321). O sistema usa o
 * formato brasileiro com máscara (11) 98765-4321 — por isso a conversão
 * acontece logo na entrada, e a comparação de telefones ignora o DDI.
 */

export function apenasDigitos(valor: string) {
  return (valor || "").replace(/\D/g, "");
}

/** Tira acentos, troca hífen por espaço e deixa minúsculo — para comparar textos. */
export function semAcento(valor: string) {
  return (valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Converte o `wa_id` no formato de telefone do sistema.
 * 5511987654321 → (11) 98765-4321
 * Números de fora do BR keep o formato internacional (+...).
 */
export function normalizarTelefone(waId: string) {
  const bruto = apenasDigitos(waId);
  if (!bruto) return "";

  let nacional = bruto;
  if (nacional.startsWith("55") && nacional.length > 11) {
    nacional = nacional.slice(2);
  }

  if (nacional.length === 11) {
    return nacional.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (nacional.length === 10) {
    return nacional.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return `+${bruto}`;
}

/** Dígitos comparáveis (sem DDI) — para casar telefones gravados de jeitos diferentes. */
export function digitosComparaveis(valor: string) {
  let d = apenasDigitos(valor);
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  return d;
}

/** true quando os dois telefones são o mesmo número (ignora máscara e DDI). */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const x = digitosComparaveis(a);
  const y = digitosComparaveis(b);
  return x.length >= 10 && x === y;
}

/** Nomes de perfil genéricos do WhatsApp — não servem como nome do cliente. */
const NOMES_GENERICOS = [
  "contato",
  "sem nome",
  "unnamed",
  "whatsapp",
  "unknown",
  "desconhecido",
  "sem contato",
];

export function nomeUtil(pushname: string | null | undefined) {
  const nome = (pushname || "").trim();
  if (!nome) return null;
  if (NOMES_GENERICOS.includes(semAcento(nome))) return null;
  if (nome.length < 2) return null;
  return nome;
}

const PADROES_NOME: { padrao: RegExp; grupo: number }[] = [
  { padrao: /meu nome (?:é|e)\s+/i, grupo: 1 },
  { padrao: /me chamo\s+/i, grupo: 1 },
  { padrao: /meu nome:\s*/i, grupo: 1 },
  { padrao: /aqui é\s+/i, grupo: 1 },
  { padrao: /falo com\s+/i, grupo: 1 },
];

/**
 * Tenta descobrir o nome real do cliente dentro do texto da mensagem
 * ("meu nome é João" → "João"). Só aceita nomes plausíveis.
 */
export function extrairNomeDoTexto(texto: string) {
  const original = texto || "";

  for (const { padrao } of PADROES_NOME) {
    const m = original.match(padrao);
    if (!m || m.index === undefined) continue;

    const resto = original.slice(m.index + m[0].length).split(/[.,;\n!?]/)[0].trim();
    if (resto.length < 3 || resto.length > 40) continue;
    if (!/^[A-Za-zÀ-ÿ' -]+$/.test(resto)) continue;

    // "me chamo silva" pode ser sobrenome — exige 2 palavras ou nome com 3+ letras
    const partes = resto.split(/\s+/);
    if (partes.length === 1 && partes[0].length < 4) continue;

    return partes
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(" ");
  }

  return null;
}

/** Tipo da mensagem + texto legível (mídia vira "[imagem]" etc.). */
export function extrairConteudo(mensagem: any): { tipo: string; texto: string } {
  const tipo = mensagem?.type || "text";

  if (tipo === "text") {
    return { tipo, texto: mensagem?.text?.body || "" };
  }
  if (tipo === "button") {
    return { tipo, texto: mensagem?.button?.text || "" };
  }
  if (tipo === "interactive") {
    const lista =
      mensagem?.interactive?.list_reply?.title ||
      mensagem?.interactive?.button_reply?.title ||
      mensagem?.interactive?.type ||
      "";
    return { tipo, texto: String(lista) };
  }
  if (tipo === "location") {
    return { tipo, texto: "Localização enviada" };
  }
  if (tipo === "contacts") {
    return { tipo, texto: "Contato compartilhado" };
  }
  if (tipo === "image") return { tipo, texto: "[imagem]" };
  if (tipo === "audio" || tipo === "ptt") return { tipo, texto: "[áudio]" };
  if (tipo === "video") return { tipo, texto: "[vídeo]" };
  if (tipo === "document") return { tipo, texto: "[documento]" };
  if (tipo === "sticker") return { tipo, texto: "[figurinha]" };

  return { tipo, texto: `[${tipo}]` };
}
