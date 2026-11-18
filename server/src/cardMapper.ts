// Conversion entre el modelo de dominio `Card` (@roampass/shared) y la fila `CardQuestion`.

import type { CardQuestion, Prisma } from '@prisma/client';
import type { Card, CardTranslation, ImageCredit, Locale, QuizCategory } from '@roampass/shared';

type Translations = Partial<Record<Locale, CardTranslation>>;

export function cardToRow(card: Card): Prisma.CardQuestionCreateInput {
  const base = {
    id: card.id,
    category: card.category,
    translations: (card.translations ?? undefined) as Prisma.InputJsonObject | undefined,
  };
  switch (card.category) {
    case 'LOCATION':
      return {
        ...base,
        difficulty: card.difficulty,
        prompt: card.prompt,
        imageUrl: card.imageUrl ?? null,
        latitude: card.location.lat,
        longitude: card.location.lng,
        answerLabel: card.answerLabel,
        credit: card.credit as Prisma.InputJsonObject | undefined,
      };
    case 'TRAVEL_EVENT':
      return { ...base, prompt: card.title, description: card.description, icon: card.icon, points: card.points };
    default:
      return {
        ...base,
        difficulty: card.difficulty,
        prompt: card.prompt,
        imageUrl: card.imageUrl ?? null,
        countryCode: card.countryCode ?? null,
        options: card.options,
        correctAnswer: card.correctAnswer,
        funFact: card.funFact ?? null,
        credit: card.credit as Prisma.InputJsonObject | undefined,
      };
  }
}

export function rowToCard(row: CardQuestion): Card {
  const credit = (row.credit ?? undefined) as ImageCredit | undefined;
  const translations = (row.translations ?? undefined) as Translations | undefined;
  const extra = translations ? { translations } : {};
  switch (row.category) {
    case 'LOCATION':
      return {
        id: row.id,
        category: 'LOCATION',
        difficulty: row.difficulty ?? 'MEDIUM',
        prompt: row.prompt,
        imageUrl: row.imageUrl ?? undefined,
        location: { lat: row.latitude ?? 0, lng: row.longitude ?? 0 },
        answerLabel: row.answerLabel ?? '',
        credit,
        ...extra,
      };
    case 'TRAVEL_EVENT':
      return {
        id: row.id,
        category: 'TRAVEL_EVENT',
        title: row.prompt,
        description: row.description ?? '',
        icon: row.icon ?? '✈️',
        points: row.points ?? 0,
        ...extra,
      };
    default:
      return {
        id: row.id,
        category: row.category as QuizCategory,
        difficulty: row.difficulty ?? 'MEDIUM',
        prompt: row.prompt,
        imageUrl: row.imageUrl ?? undefined,
        countryCode: row.countryCode ?? undefined,
        options: row.options,
        correctAnswer: row.correctAnswer ?? '',
        funFact: row.funFact ?? undefined,
        credit,
        ...extra,
      };
  }
}
