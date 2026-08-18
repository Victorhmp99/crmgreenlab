/**
 * Validação anti-lixo do formulário da landing.
 *
 * Portado do funil Shark, onde as regras foram calibradas em cima de lead
 * real. A intenção é filtrar quem está testando o formulário ou digitando
 * qualquer coisa pra ver o que acontece — sem barrar gente de verdade.
 *
 * Princípio: quando houver dúvida, DEIXA PASSAR. Um lead ruim custa uma
 * ligação perdida; um lead bom barrado custa a venda inteira.
 */

// ── Vocabulário de lixo ──────────────────────────────────────────────────────

/* Radicais (casam dentro da palavra): "testando", "verificacao", "exemplo". */
const FAKE_NAME_STEMS = [
  'teste', 'testand', 'testar', 'testad', 'testing', 'tester',
  'valid', 'verific', 'checand', 'checagem', 'conferind', 'conferir',
  'exempl', 'amostr', 'sample', 'demonstr', 'rascunh', 'provand',
  'simul', 'dummy', 'placehold', 'generic', 'padrao',
  'lorem', 'ipsum', 'falso', 'falsa', 'mentira', 'brincadeir', 'brincand',
  'temporari', 'xpto', 'foobar',
  'fulano', 'ciclano', 'beltrano', 'seunome',
]

/* Palavras inteiras. Inclui teclado amassado que tem vogal e escaparia
   das outras regras ("asdas", "aoi"). */
const FAKE_NAME_EXACT = new Set([
  'demo', 'temp', 'foo', 'bar', 'abc', 'abcd', 'abcde', 'abcdef',
  'asdf', 'asdfg', 'asdfgh', 'qwerty', 'qwe',
  'nao', 'naosei', 'sei', 'sla', 'oi', 'ola', 'kkk', 'kkkk',
  'nada', 'vazio', 'embranco', 'qualquer', 'aaa', 'bbb', 'ccc',
  'nome', 'sobrenome', 'xxxx', 'yyyy', 'zzzz',
  'asd', 'asda', 'asdas', 'asdasd', 'asdasda', 'sda', 'sad', 'dsa',
  'zxc', 'zxcv', 'qaz', 'wsx', 'edc', 'lkj', 'lkjh', 'poiu', 'aoi',
])

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890']
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y'])

/* Partículas de nome: curtas e sem vogal suficiente, ficariam fora das
   checagens de "parece nome" e derrubariam "Ana de Souza". */
const NAME_PARTICLES = new Set([
  'de', 'da', 'do', 'dos', 'das', 'e', 'di', 'du', 'del', 'la', 'van', 'von', 'bin', 'al',
])

// ── Helpers ──────────────────────────────────────────────────────────────────

export function normalizeText(str: string): string {
  return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Sequência de 4 teclas vizinhas: asdf, qwer, zxcv (e ao contrário). */
function hasKeyboardRun(word: string): boolean {
  if (word.length < 4) return false
  for (const row of KEYBOARD_ROWS) {
    const rev = [...row].reverse().join('')
    for (let i = 0; i <= word.length - 4; i++) {
      const chunk = word.slice(i, i + 4)
      if (row.includes(chunk) || rev.includes(chunk)) return true
    }
  }
  return false
}

function maxConsonantRun(word: string): number {
  let run = 0, max = 0
  for (const ch of word) {
    if (/[a-z]/.test(ch) && !VOWELS.has(ch)) { run++; if (run > max) max = run }
    else run = 0
  }
  return max
}

function isRepeatedDigits(s: string): boolean {
  return /^(\d)\1+$/.test(s)
}

function isSequentialDigits(s: string): boolean {
  let asc = true, desc = true
  for (let i = 1; i < s.length; i++) {
    if (+s[i] !== +s[i - 1] + 1) asc = false
    if (+s[i] !== +s[i - 1] - 1) desc = false
  }
  return asc || desc
}

/**
 * Mesma ideia, mas tratando 9→0 como continuação — cobre "1234567890" e
 * "0987654321", a fileira de números inteira como quem testa costuma digitar.
 * Ausente no original: lá o corte em "9"→"0" quebrava a sequência e o número
 * inteiro passava despercebido.
 */
function isSequentialDigitsComVolta(s: string): boolean {
  let asc = true, desc = true
  for (let i = 1; i < s.length; i++) {
    const anterior = +s[i - 1], atual = +s[i]
    if (atual !== (anterior + 1) % 10) asc = false
    if (atual !== (anterior + 9) % 10) desc = false
  }
  return asc || desc
}

// ── Nome ─────────────────────────────────────────────────────────────────────

export function isFakeName(rawName: string): boolean {
  const norm = normalizeText(rawName.trim())
  if (!norm) return true

  const compact = norm.replace(/\s+/g, '')
  if (compact.length < 4) return true
  if (!/[a-z]/.test(compact)) return true      // só números/símbolos
  if (/^(.)\1+$/.test(compact)) return true    // "aaaaaa"

  const words = norm.split(/\s+/).filter(Boolean)
  if (words.length < 2) return true             // exige nome + sobrenome

  // Tira numeral do fim ("teste123" continua sendo "teste")
  const stripped = words.map((w) => w.replace(/[0-9]+$/, ''))
  if (stripped.some((w) => FAKE_NAME_EXACT.has(w))) return true
  if (stripped.some((w) => FAKE_NAME_STEMS.some((stem) => w.includes(stem)))) return true

  // Mesma palavra repetida ("asdas asdas"): ninguém se chama assim.
  const significant = stripped.filter((w) => w.length >= 3 && !NAME_PARTICLES.has(w))
  if (significant.length >= 2 && new Set(significant).size === 1) return true

  for (const w of significant) {
    // Toda palavra de nome real tem vogal — "sdfg", "jkl" não têm.
    if (![...w].some((ch) => VOWELS.has(ch))) return true
    if (hasKeyboardRun(w)) return true
    // 5+ consoantes seguidas não existe nem em sobrenome estrangeiro:
    // o pior caso real ("Szczepan", "Schwartz") chega a 4.
    if (maxConsonantRun(w) >= 5) return true
  }
  return false
}

// ── Instagram ────────────────────────────────────────────────────────────────

/* Regra real do @: 2 a 30 caracteres, letras/números/ponto/underscore,
   sem ponto no começo ou fim e sem dois pontos seguidos. */
const INSTAGRAM_HANDLE_RE = /^(?!\.)(?!.*\.\.)(?!.*\.$)[A-Za-z0-9._]{2,30}$/

/** Muita gente cola o link do perfil em vez do @ — extraímos em vez de reclamar. */
export function normalizeInstagramHandle(raw: string): string {
  let v = String(raw || '').trim()
  const fromUrl = v.match(/(?:instagram\.com|instagr\.am)\/+([^/?#\s]+)/i)
  if (fromUrl) v = fromUrl[1]
  return v.replace(/^@+/, '').trim()
}

/* Conservador de propósito: só pega o inequivocamente lixo. NÃO usa
   FAKE_NAME_STEMS aqui — perfil real do nicho pode conter "teste" dentro de
   outra palavra (ex: @testosterona.clinic). */
export function isFakeInstagram(handle: string): boolean {
  const core = normalizeText(handle).replace(/[._0-9]/g, '')
  if (!core) return true                     // só pontos, números ou underscore
  if (FAKE_NAME_EXACT.has(core)) return true
  if (hasKeyboardRun(core)) return true
  return false
}

// ── Telefone ─────────────────────────────────────────────────────────────────

const VALID_BR_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
])

export function isFakePhone(digits: string, isBrazil = true): boolean {
  if (digits.length < 8) return true
  if (isRepeatedDigits(digits)) return true
  if (digits.length >= 6 && (isSequentialDigits(digits) || isSequentialDigitsComVolta(digits))) return true

  if (isBrazil) {
    if (digits.length !== 10 && digits.length !== 11) return true

    const ddd = Number(digits.slice(0, 2))
    if (!VALID_BR_DDDS.has(ddd)) return true

    const local = digits.slice(2)
    if (isRepeatedDigits(local)) return true
    // Celular (11 dígitos) sempre começa com 9 depois do DDD.
    if (digits.length === 11 && local[0] !== '9') return true

    const localCore = digits.length === 11 ? local.slice(1) : local
    if (localCore.length >= 5 && (isRepeatedDigits(localCore) || isSequentialDigits(localCore))) return true
  }
  return false
}

/** Máscara visual (11) 96234-8517 — só formata, não valida. */
export function formatPhoneBR(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2)  return d
  if (d.length <= 6)  return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// ── Validação do formulário inteiro ──────────────────────────────────────────

export interface CamposLanding {
  nome:        string
  whatsapp:    string
  instagram:   string
  faturamento: string
}

export type ErrosLanding = Partial<Record<keyof CamposLanding, string>>

/* As mensagens dizem o PORQUÊ do campo, não só "inválido" — explicar pra que
   serve converte melhor do que apenas apontar o erro. */
export function validarLanding(campos: CamposLanding): ErrosLanding {
  const erros: ErrosLanding = {}

  if (isFakeName(campos.nome)) {
    erros.nome = 'Preencha nome e sobrenome de verdade — é assim que vamos te chamar na conversa.'
  }

  const digits = campos.whatsapp.replace(/\D/g, '')
  if (!digits) {
    erros.whatsapp = 'Precisamos do WhatsApp para marcar a call.'
  } else if (isFakePhone(digits)) {
    erros.whatsapp = 'Digite um WhatsApp válido, com DDD (ex: 11 96234-8517).'
  }

  // Instagram é opcional: só valida se a pessoa escreveu algo.
  const handle = normalizeInstagramHandle(campos.instagram)
  if (handle && (!INSTAGRAM_HANDLE_RE.test(handle) || isFakeInstagram(handle))) {
    erros.instagram = 'Esse @ não parece válido. Use seu perfil real (ex: dra.marina.silva).'
  }

  if (!campos.faturamento) {
    erros.faturamento = 'Escolha uma faixa — é o que define como a call é preparada.'
  }

  return erros
}
