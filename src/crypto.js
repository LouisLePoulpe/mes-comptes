// ── CONSTANTES ──────────────────────────────────────────────────────────────
const PBKDF2_ITERATIONS = 310000
const SALT_KEY = "mes-comptes-salt"
const KEY_KEY = "mes-comptes-key"

// ── UTILITAIRES ─────────────────────────────────────────────────────────────
const buf2hex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("")
const hex2buf = (hex) => new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b,16))).buffer
const buf2b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const b642buf = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer

// ── DÉRIVER LA CLÉ DEPUIS LA PASSPHRASE ─────────────────────────────────────
export async function deriveKey(passphrase, saltHex) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
  )
  const salt = saltHex ? hex2buf(saltHex) : crypto.getRandomValues(new Uint8Array(32)).buffer
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  )
  return { key, saltHex: saltHex || buf2hex(salt) }
}

// ── CHIFFRER ────────────────────────────────────────────────────────────────
export async function encrypt(data, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(data))
  )
  return {
    iv: buf2b64(iv.buffer),
    data: buf2b64(encrypted)
  }
}

// ── DÉCHIFFRER ──────────────────────────────────────────────────────────────
export async function decrypt(encrypted, key) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b642buf(encrypted.iv) },
    key,
    b642buf(encrypted.data)
  )
  return JSON.parse(new TextDecoder().decode(decrypted))
}

// ── GÉNÉRER LA CLÉ DE RÉCUPÉRATION (24 mots) ────────────────────────────────
const WORDLIST = [
  "able","acid","aged","also","area","army","away","baby","back","ball",
  "band","bank","base","bath","bear","beat","been","bell","best","bird",
  "blue","body","bomb","bond","bone","book","born","both","bulk","burn",
  "call","calm","came","card","care","case","cash","cast","cave","cell",
  "chat","chef","city","clap","clay","club","clue","coal","code","cold",
  "come","cool","cope","copy","core","cost","coup","crew","crop","cure",
  "dark","data","date","dawn","days","dead","deal","dear","debt","deep",
  "deny","desk","diet","dirt","disk","dock","does","done","door","dose",
  "down","draw","drop","drug","drum","dual","dull","dump","dusk","dust",
  "each","earn","ease","east","edge","else","emit","epic","euro","even",
  "ever","evil","exam","exit","face","fact","fade","fail","fair","fall",
  "fame","farm","fast","fate","fear","feed","feel","feet","fell","felt",
  "file","fill","film","find","fine","fire","firm","fish","fist","flag",
  "flat","flew","flip","flow","foam","fold","folk","fond","font","food",
  "fool","foot","ford","fore","fork","form","fort","four","free","from",
  "fuel","full","fund","fuse","gain","game","gave","gene","gift","girl",
  "give","glad","glow","glue","goal","gold","golf","gone","good","grab",
  "grew","grid","grim","grip","grow","gulf","guru","gust","halt","hand",
  "hang","hard","harm","hate","have","head","heal","heap","heat","held",
  "help","here","hero","high","hill","hint","hold","hole","holy","home",
  "hope","horn","host","hour","huge","hung","hunt","hurt","idea","idle",
  "inch","into","iron","isle","item","jail","join","joke","jump","just",
  "keep","kind","king","knew","know","lack","lady","laid","land","lane"
]

export function generateRecoveryKey() {
  const words = []
  for (let i = 0; i < 24; i++) {
    const rand = crypto.getRandomValues(new Uint32Array(1))[0]
    words.push(WORDLIST[rand % WORDLIST.length])
  }
  return words.join("-")
}

// ── STOCKER / RÉCUPÉRER LA CLÉ LOCALE ───────────────────────────────────────
export async function saveKeyLocally(key, saltHex) {
  const exported = await crypto.subtle.exportKey("raw", key)
  localStorage.setItem(KEY_KEY, buf2b64(exported))
  localStorage.setItem(SALT_KEY, saltHex)
}

export async function loadKeyLocally() {
  const keyB64 = localStorage.getItem(KEY_KEY)
  const saltHex = localStorage.getItem(SALT_KEY)
  if (!keyB64 || !saltHex) return null
  const key = await crypto.subtle.importKey(
    "raw", b642buf(keyB64), { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
  )
  return { key, saltHex }
}

export function clearKeyLocally() {
  localStorage.removeItem(KEY_KEY)
  localStorage.removeItem(SALT_KEY)
}