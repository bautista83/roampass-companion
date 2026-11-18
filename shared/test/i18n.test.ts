import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  RULES_SECTIONS,
  buildRules,
  categoryMeta,
  countryName,
  formatMiles,
  generateCountryCards,
  localizeCard,
  resolveLocale,
  type CountryData,
  type Locale,
  type QuizCard,
  type TravelEventCard,
} from '../src';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import countries from '../data/countries.json';

/** Idioma ficticio para probar el camino de traduccion mientras solo existe 'es'. */
const EN = 'en' as unknown as Locale;

/** Formas de voseo que no deben aparecer (IA-02: español latino neutro). */
// Limites de palabra con \p{L}: \b no reconoce letras con tilde.
const VOSEO =
  /(^|[^\p{L}])(tirá|tirás|tocá|elegí|elegís|sumá|sumás|mové|retrocedé|seguí|respondé|acertás|avanzás|marcás|creés|jugás|llegás|probá|podés|tenés|querés|sabés|mirá|dejá|usá|ingresá|contactá|volvé|poné|hacé|esperá|confirmá|revisá|agregá|abrí|escribí|cerrá|repetila|elegila|sacate|registrate|acá)(?!\p{L})/iu;

it('el detector de voseo funciona con tildes', () => {
  expect('Tocá el dado').toMatch(VOSEO);
  expect('Repetila').toMatch(VOSEO);
  expect('Toca el dado').not.toMatch(VOSEO);
  expect('Elige la meta').not.toMatch(VOSEO);
});

describe('idiomas', () => {
  it('resuelve el idioma del perfil o del navegador', () => {
    expect(resolveLocale('es-AR')).toBe('es');
    expect(resolveLocale(null, 'fr-FR', 'es')).toBe('es');
    expect(resolveLocale('xx')).toBe(DEFAULT_LOCALE);
  });

  it('las reglas en el idioma por defecto son las mismas que las constantes', () => {
    expect(buildRules('es').sections).toEqual(RULES_SECTIONS);
  });

  it('las reglas usan tuteo neutro, sin voseo', () => {
    const { sections, physicalBoard } = buildRules('es');
    const all = [...physicalBoard, ...sections.flatMap((s) => [s.title, s.summary, ...s.points])].join(' ');
    expect(all).not.toMatch(VOSEO);
  });

  it('los textos de la interfaz (cliente) usan tuteo neutro, sin voseo', () => {
    const dir = join(__dirname, '../../client/src/i18n/locales/es');
    const values = (v: unknown): string[] =>
      typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(values) : [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      for (const text of values(JSON.parse(readFileSync(join(dir, file), 'utf8')))) {
        expect(text, `${file}: «${text}»`).not.toMatch(VOSEO);
      }
    }
  });

  it('formatea millas con el separador del idioma', () => {
    expect(formatMiles(4000)).toBe('4.000 mi');
    expect(categoryMeta('es').FLAG).toMatchObject({ label: 'Bandera', icon: '🏁' });
  });
});

describe('cartas traducibles', () => {
  const quiz: QuizCard = {
    id: 'q1',
    category: 'HISTORY',
    difficulty: 'EASY',
    prompt: '¿En qué año cayó el Muro de Berlín?',
    options: ['1985', '1989', '1991', '1995'],
    correctAnswer: '1989',
    funFact: 'Dato',
    translations: { [EN]: { prompt: 'When did the Berlin Wall fall?', options: ['85', '89', '91', '95'], funFact: 'Fact' } },
  };

  it('sin traduccion o en el idioma por defecto, queda igual', () => {
    expect(localizeCard(quiz, 'es')).toBe(quiz);
    const { translations: _t, ...plain } = quiz;
    expect(localizeCard(plain as QuizCard, EN)).toEqual(plain);
  });

  it('traduce los textos y la respuesta correcta por posicion', () => {
    const tr = localizeCard(quiz, EN);
    expect(tr.prompt).toBe('When did the Berlin Wall fall?');
    expect(tr.options).toEqual(['85', '89', '91', '95']);
    expect(tr.correctAnswer).toBe('89');
    expect(tr.funFact).toBe('Fact');
  });

  it('ignora opciones traducidas incompletas', () => {
    const broken = { ...quiz, translations: { [EN]: { options: ['A', 'B'] } } } as QuizCard;
    const tr = localizeCard(broken, EN);
    expect(tr.options).toEqual(quiz.options);
    expect(tr.correctAnswer).toBe('1989');
  });

  it('traduce eventos de viajero', () => {
    const ev: TravelEventCard = {
      id: 'e1',
      category: 'TRAVEL_EVENT',
      title: 'Visa denegada',
      description: 'Retrocede',
      points: -1500,
      icon: '🛂',
      translations: { [EN]: { title: 'Visa denied' } },
    };
    expect(localizeCard(ev, EN)).toMatchObject({ title: 'Visa denied', description: 'Retrocede', points: -1500 });
  });

  it('los nombres de paises en otros idiomas salen de Intl', () => {
    expect(countryName('ar', 'es', 'Argentina')).toBe('Argentina');
    expect(countryName('de', EN, 'Alemania')).toBe('Germany');
  });

  it('las cartas generadas de paises siguen el idioma', () => {
    const data = countries as unknown as CountryData;
    const es = generateCountryCards(data).find((c) => c.id === 'gen-flag-de')!;
    expect(es.correctAnswer).toBe('Alemania');
    const en = generateCountryCards(data, [], EN).find((c) => c.id === 'gen-flag-de')!;
    expect(en.correctAnswer).toBe('Germany');
    expect(en.options).toContain('Germany');
  });
});
