// Español latino neutro (tuteo). Textos compartidos: etiquetas, reglas y cartas generadas.
import type { SharedTexts } from './types';

export const es: SharedTexts = {
  intl: 'es',
  list: { and: 'y', or: 'o' },
  categories: {
    LOCATION: { label: 'Lugar', hint: 'Ubica la foto en el mapa' },
    FLAG: { label: 'Bandera', hint: '¿De qué país es?' },
    CITY: { label: 'Capitales y Ciudades', hint: 'Metrópolis del mundo' },
    HISTORY: { label: 'Historia Mundial', hint: 'Años y eventos' },
    PERSONALITY: { label: 'Personalidades', hint: '¿De dónde es?' },
    TRAVEL_EVENT: { label: 'Evento de Viajero', hint: '¡Suerte en la aduana!' },
  },
  difficulties: {
    EASY: { label: 'Fácil' },
    MEDIUM: { label: 'Normal' },
    HARD: { label: 'Difícil' },
  },
  pawnColors: {
    red: 'Rojo',
    blue: 'Azul',
    green: 'Verde',
    yellow: 'Amarillo',
    purple: 'Morado',
    orange: 'Naranja',
    pink: 'Rosa',
    teal: 'Turquesa',
  },
  milesUnit: 'mi',
  pointTarget: { full: 'vuelta completa', half: 'media vuelta', other: 'meta' },
  countryCards: {
    flagPrompt: '¿A qué país pertenece esta bandera?',
    capitalOfCountry: (country) => `¿Cuál es la capital de ${country}?`,
    countryOfCapital: (capital) => `${capital} es la capital de… ¿qué país?`,
    decoyOne: (city) => `Ojo: ${city} no es la capital.`,
    decoyMany: (cities) => `Ojo: ni ${cities.join(', ni ')} son la capital.`,
  },
  rules: (p) => ({
    physicalBoard: [
      `Cada jugador pone su ficha en la salida: ${p.start}.`,
      'Tira el dado físico (o toca el dado de la app) y toca en la app la carta del número que salió.',
      `Cuando sumas millas, mueve tu ficha una casilla por cada ${p.mi(p.milesPerSpace)}. Si un evento te resta millas, retrocede.`,
      'El marcador de la app muestra en qué casilla tiene que estar cada ficha.',
    ],
    sections: {
      goal: {
        title: 'De qué se trata',
        summary:
          'Son viajeros dando la vuelta al mundo. Cada respuesta correcta da millas, y con las millas la ficha avanza por el tablero.',
        points: [
          `Cada casilla del tablero vale ${p.mi(p.milesPerSpace)}.`,
          `La vuelta al mundo completa son ${p.boardSpaces} casillas: ${p.mi(p.worldTourMiles)}.`,
          `Todos salen de la misma casilla: ${p.start}.`,
        ],
      },
      setup: {
        title: 'Cómo empezar',
        summary: 'En el panel toca «Crear Nueva Partida» y sigue los pasos.',
        points: [
          'Elige el tablero: el impreso con un dado físico, o el tablero digital en la pantalla.',
          `Elige la meta: llegar a ${p.list(
            p.pointTargets.map((t) => `${p.mi(t.miles)} (${t.label})`),
            'or',
          )}, o jugar ${p.list(p.roundTargets, 'or')} rondas.`,
          `Elige el tiempo para responder cada carta: ${p.list(p.timerOptions, 'or')} segundos (si no eliges, ${p.defaultTimer}).`,
          `Suma de ${p.minPlayers} a ${p.maxPlayers} jugadores, cada uno con su color de ficha y su avatar.`,
        ],
      },
      turn: {
        title: 'Tu turno',
        summary: 'Se juega por turnos, uno por persona. Cada turno tiene cuatro pasos:',
        points: [
          'Tira el dado: cada número es una categoría de carta.',
          'Se abre una carta de esa categoría y arranca el reloj.',
          'Responde antes de que se termine el tiempo. Si se termina, la carta cuenta como error.',
          'Si aciertas, sumas millas y tu ficha avanza. Después le toca al siguiente.',
        ],
      },
      cards: {
        title: 'Las cartas y sus millas',
        summary: 'Cada categoría da distintas millas. Una respuesta incorrecta da 0.',
        points: [
          `Las cartas tienen nivel: ${p.list(
            p.difficulties.map((d) => `${d.label} (+${p.num(d.bonus)})`),
            'and',
          )} millas extra.`,
          `En las cartas de ${p.locationLabel} ves una foto o Street View y marcas en el mapa dónde crees que es. Cuanto más cerca, más millas; a más de ${p.num(p.lastBracketKm)} km no suma.`,
          'Ninguna carta se repite en la partida. Si una categoría se queda sin cartas, aparece «Agotada».',
        ],
      },
      travel: {
        title: 'Eventos y transportes',
        summary: `Las cartas de ${p.travelEventLabel} no tienen pregunta: te hacen avanzar o retroceder casillas.`,
        points: [
          `Salen con el ${p.eventFace} del dado.`,
          `Si después de acertar una carta tu ficha cae en una casilla de transporte, en el mismo turno juegas también un ${p.travelEventLabel}.`,
          'Pasar por encima de un transporte no cuenta, y si llegas por un evento tampoco.',
          `Las millas nunca bajan de ${p.minScore}.`,
        ],
      },
      win: {
        title: 'Cómo se gana',
        summary: 'Depende de la meta que eligieron al empezar.',
        points: [
          'Por millas: gana quien llega primero a la meta, y la partida termina en ese momento.',
          'Por rondas: cuando se termina la última ronda, gana quien tiene más millas.',
          'Si hay empate, gana quien tiene más aciertos. Si siguen iguales, comparten el puesto.',
          'Con «Terminar ahora» la partida se cierra antes y gana quien va primero.',
        ],
      },
    },
  }),
};
