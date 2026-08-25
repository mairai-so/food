// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  IDIOMA_LABEL,
  IDIOMA_BANDEIRA,
  IDIOMA_BCP47,
  IDIOMAS_ORDENADOS,
  resolveIdiomaPeloNavegador,
  auditarDicionario,
  isIdioma,
} from "../idioma.ts";

const ARTIFACTS = path.resolve(import.meta.dirname, "../../../artifacts");

/**
 * Carrega um traducoes.ts de um app dinamicamente (módulos TS nativos do Node 22+).
 */
async function loadTraducoes(app: string) {
  const file = path.join(ARTIFACTS, app, "src/i18n/traducoes.ts");
  const mod = await import(pathToFileURL(file).href);
  return mod.TRADUCOES;
}

function pathToFileURL(p: string) {
  return new URL("file://" + (process.platform === "win32" ? "/" : "") + p);
}

const APPS = fs.readdirSync(ARTIFACTS).filter((a) =>
  fs.existsSync(path.join(ARTIFACTS, a, "src/i18n/traducoes.ts")),
);

// ---------------- identidade dos idiomas ----------------

test("Español usa a bandeira de Espanha, nunca a do Paraguai", () => {
  assert.equal(IDIOMA_BANDEIRA.es, "🇪🇸");
  assert.notEqual(IDIOMA_BANDEIRA.es, IDIOMA_BANDEIRA.gn);
  // o Paraguai só aparece no Guarani, língua nativa do lado paraguaio da fronteira
  assert.equal(IDIOMA_BANDEIRA.gn, "🇵🇾");
});

test("todos os idiomas têm rótulo e bandeira definidos", () => {
  for (const i of IDIOMAS_ORDENADOS) {
    assert.ok(IDIOMA_LABEL[i], `rótulo ausente para ${i}`);
    assert.ok(IDIOMA_BANDEIRA[i], `bandeira ausente para ${i}`);
  }
});

test("códigos BCP-47 corretos (pt-BR para a voz da marca)", () => {
  assert.equal(IDIOMA_BCP47.pt, "pt-BR");
  assert.equal(IDIOMA_BCP47.es, "es");
  assert.equal(IDIOMA_BCP47.gn, "gn");
  assert.equal(IDIOMA_BCP47.en, "en");
});

test("resolveIdiomaPeloNavegador deteta guarani e fallback para pt", () => {
  assert.equal(resolveIdiomaPeloNavegador("gn"), "gn");
  assert.equal(resolveIdiomaPeloNavegador("gn-PY"), "gn");
  assert.equal(resolveIdiomaPeloNavegador("es-419"), "es");
  assert.equal(resolveIdiomaPeloNavegador("en-US"), "en");
  assert.equal(resolveIdiomaPeloNavegador("de-DE"), "pt");
  assert.equal(resolveIdiomaPeloNavegador(""), "pt");
});

test("isIdioma valida e rejeita valores estranhos", () => {
  assert.ok(isIdioma("pt"));
  assert.ok(isIdioma("gn"));
  assert.equal(isIdioma("fr"), false);
  assert.equal(isIdioma(null), false);
});

// ---------------- saúde dos dicionários de cada app ----------------

for (const app of APPS) {
  test(`${app}: chaves de pt existem em todos os idiomas e nenhum valor está em Português fora do pt`, async () => {
    const TRADUCOES = await loadTraducoes(app);
    const aud = auditarDicionario(TRADUCOES);
    assert.deepEqual(
      aud.ausentes,
      { es: [], gn: [], en: [] },
      `${app}: chaves ausentes em algum idioma: ${JSON.stringify(aud.ausentes)}`,
    );
    assert.deepEqual(
      aud.pendentes,
      { es: [], gn: [], en: [] },
      `${app}: valores ainda em Português fora do pt: ${JSON.stringify(aud.pendentes)}`,
    );
    assert.deepEqual(aud.duplicadas, { es: [], gn: [], en: [], pt: [] });
  });

  test(`${app}: bandeira de Español é a da Espanha e a de Guarani a do Paraguai`, async () => {
    const file = path.join(ARTIFACTS, app, "src/i18n/traducoes.ts");
    const src = fs.readFileSync(file, "utf-8");
    // a segunda ocorrência de `es:` no ficheiro é a bandeira (a primeira é o rótulo)
    const es = [...src.matchAll(/es:\s*"([^"]+)"/g)].map((m) => m[1]);
    assert.equal(es.length >= 2 && es[1] === "🇪🇸", true,
      `${app}: bandeira de es errada (${JSON.stringify(es)})`);
    const gn = [...src.matchAll(/gn:\s*"([^"]+)"/g)].map((m) => m[1]);
    assert.equal(gn.length >= 2 && gn[1] === "🇵🇾", true,
      `${app}: bandeira de gn errada (${JSON.stringify(gn)})`);
  });

  test(`${app}: fallback em cascata não devolve o identificador técnico`, async () => {
    // simula o comportamento do t() dos IdiomaContext: idioma -> pt -> ''
    const TRADUCOES = await loadTraducoes(app);
    const t = (idioma, chave) => TRADUCOES[idioma][chave] ?? TRADUCOES.pt[chave] ?? "";
    for (const chave of Object.keys(TRADUCOES.pt)) {
      for (const idioma of ["es", "gn", "en"]) {
        const v = t(idioma, chave);
        assert.notEqual(v, chave, `${app}/${idioma}: "${chave}" devolveria o identificador técnico`);
      }
    }
  });
}

test("nenhum app mostra a chave técnica como texto visível (varredura por padrão de chave)", async () => {
  // varredura defensiva: procura strings literais no formato `x.y` em JSX
  const regex = /^"[a-z0-9._:-]+([A-Z][a-z0-9]*)?"$/;
  for (const app of APPS) {
    const src = fs.readFileSync(path.join(ARTIFACTS, app, "src/App.tsx"), "utf-8");
    // só literais JSX com um ponto e segmento camelCase no meio são suspeitas
    // (ex.: chave "auth.Email" escrita como texto bruto) — exclui textos normais
    // como "Senha fraca..." que não contêm o padrão x.y
    const suspects = (src.match(/"[a-zA-Z0-9]+\.[a-zA-Z0-9]+"/g) || []).filter(
      (s) => !s.startsWith("{t(") && /[a-z]\.[a-z]/i.test(s) &&
        /[a-z][A-Z]/.test(s.replace(/^[a-z0-9.]+\./, "").replace(/["{}]/g, "")),
    );
    assert.equal(suspects.length, 0, `${app}: chaves técnicas como texto bruto: ${suspects.join(", ")}`);
  }
});
