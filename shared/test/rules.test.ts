import { describe, expect, it } from 'vitest';
import {
  DIE_FACES,
  DIFFICULTY_BONUS,
  LOCATION_BRACKETS,
  POINT_TARGETS,
  QUIZ_POINTS,
  ROUND_TARGETS,
  RULES_DIE,
  RULES_LOCATION_BRACKETS,
  RULES_QUIZ_POINTS,
  RULES_SECTIONS,
  RULES_TRANSPORTS,
  TIMER_OPTIONS,
  WORLD_TOUR_MILES,
  formatNumber,
  pointTargetLabel,
} from '../src';

const text = (id: string) => {
  const s = RULES_SECTIONS.find((x) => x.id === id)!;
  return [s.summary, ...s.points].join(' ');
};

describe('reglas del juego', () => {
  it('tiene los seis pasos en orden', () => {
    expect(RULES_SECTIONS.map((s) => s.id)).toEqual(['goal', 'setup', 'turn', 'cards', 'travel', 'win']);
  });

  it('las millas de las preguntas salen del puntaje del motor', () => {
    for (const row of RULES_QUIZ_POINTS) {
      const base = QUIZ_POINTS[row.category as keyof typeof QUIZ_POINTS];
      expect(row.byDifficulty.EASY).toBe(base + DIFFICULTY_BONUS.EASY);
      expect(row.byDifficulty.HARD).toBe(base + DIFFICULTY_BONUS.HARD);
    }
  });

  it('los tramos de LUGAR coinciden con el motor', () => {
    expect(RULES_LOCATION_BRACKETS.map((b) => [b.maxKm, b.points])).toEqual(LOCATION_BRACKETS.map((b) => [b.maxKm, b.points]));
  });

  it('las metas, rondas y tiempos que se nombran son los del motor', () => {
    const setup = text('setup');
    for (const t of POINT_TARGETS) expect(setup).toContain(formatNumber(t));
    for (const r of ROUND_TARGETS) expect(setup).toContain(String(r));
    for (const s of TIMER_OPTIONS) expect(setup).toContain(String(s));
    expect(text('goal')).toContain(formatNumber(WORLD_TOUR_MILES));
  });

  it('el dado y los transportes salen del tablero', () => {
    expect(RULES_DIE.map((d) => d.category)).toEqual([...DIE_FACES]);
    expect(RULES_TRANSPORTS.length).toBeGreaterThan(0);
    expect(RULES_TRANSPORTS.every((t) => t.id.startsWith('t_'))).toBe(true);
  });

  it('nombra las metas como media vuelta y vuelta completa', () => {
    expect(pointTargetLabel(WORLD_TOUR_MILES)).toBe('vuelta completa');
    expect(pointTargetLabel(WORLD_TOUR_MILES / 2)).toBe('media vuelta');
  });
});
