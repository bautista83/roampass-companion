import { useTranslation } from 'react-i18next';
import { LOCATION_BRACKETS, QUIZ_POINTS, withDifficulty, type CardCategory } from '@roampass/shared';
import { useLabels } from '../../i18n/useLabels';

/** Cuantas millas puede dar cada categoria ("+2.000 a +3.000 mi"), en el idioma activo. */
export function usePointsHint(): (category: CardCategory) => string {
  const { t } = useTranslation();
  const { num, miles } = useLabels();
  return (category) => {
    if (category === 'TRAVEL_EVENT') return t('game.cards.pointsSurprise');
    if (category === 'LOCATION') return t('game.cards.pointsUpTo', { max: miles(withDifficulty(LOCATION_BRACKETS[0].points, 'HARD')) });
    const base = QUIZ_POINTS[category];
    return t('game.cards.pointsRange', { min: num(base), max: miles(withDifficulty(base, 'HARD')) });
  };
}
