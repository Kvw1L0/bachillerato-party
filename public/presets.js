// Presets de Categorías para Bachillerato Party
const CATEGORY_PRESETS = {
  clasico: {
    name: "Clásico Familiar",
    description: "El tradicional que todos conocen: Nombre, País, Animal, etc.",
    categories: [
      "Nombre",
      "País o Ciudad",
      "Animal",
      "Fruta o Verdura",
      "Cosa u Objeto",
      "Color",
      "Profesión u Oficio"
    ]
  },
  fiesta: {
    name: "Modo Fiesta & Risas",
    description: "Categorías picantes, cómicas y para debatir entre risas.",
    categories: [
      "Excusa para llegar tarde o no salir",
      "Cosa que encuentras en el bolso de una abuela",
      "Motivo ridículo de ruptura amorosa",
      "Comida o bebida que huele raro",
      "Insulto elegante o palabra graciosa",
      "Cosa que da vergüenza ajena (cringe)",
      "Celebridad que te caiga mal"
    ]
  },
  cultura_pop: {
    name: "Cultura Pop & Geek",
    description: "Películas, series, videojuegos, música y cómics.",
    categories: [
      "Película o Serie de TV",
      "Personaje ficticio / Superhéroe",
      "Videojuego o Consola",
      "Canción o Banda musical",
      "Marca o Empresa famosa",
      "Lugar ficticio del cine/literatura",
      "Actor o Actriz famosa"
    ]
  },
  mundo: {
    name: "Geografía & Naturaleza",
    description: "Para exploradores del mundo y amantes de los animales.",
    categories: [
      "País",
      "Capital o Ciudad importante",
      "Río, Lago o Mar",
      "Animal salvaje o exótico",
      "Planta, Árbol o Flor",
      "Plato típico de algún país",
      "Monumento o Maravilla del mundo"
    ]
  },
  rapido: {
    name: "Ronda Relámpago (4 Categorías)",
    description: "Ronda super veloz para partidas intensas.",
    categories: [
      "Nombre",
      "Animal",
      "Cosa",
      "País o Ciudad"
    ]
  }
};

// Alfabeto con opción de filtrar letras complejas
const ALPHABET_ALL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ALPHABET_EASY = "ABCDEFGHILMNOPQRSTUV".split(""); // Sin K, W, X, Y, Z, J

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CATEGORY_PRESETS, ALPHABET_ALL, ALPHABET_EASY };
}
