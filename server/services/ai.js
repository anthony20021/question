/**
 * Service AI unifié avec fallback
 * OpenRouter (cloud) → Ollama API (serveur distant) → Ollama (local)
 */

import * as openrouter from './openrouter.js'
import * as ollamaAPI from './ollama-api.js'
import * as ollama from './ollama.js'

let primaryProvider = null  // 'openrouter' | 'ollama-api' | 'ollama' | null
let fallbackProvider = null // 'ollama-api' | 'ollama' | null
let secondFallbackProvider = null // 'ollama' | null

/**
 * Initialise les services AI
 */
export async function initAI() {
  console.log('🤖 Initialisation des services AI...')

  // Essayer OpenRouter d'abord
  const openrouterOk = openrouter.initAI()
  if (openrouterOk) {
    primaryProvider = 'openrouter'
    console.log('✅ OpenRouter configuré comme provider principal')
  }

  // Essayer Ollama API (serveur distant) comme fallback ou principal
  const ollamaAPIOk = await ollamaAPI.initOllamaAPI()
  if (ollamaAPIOk) {
    if (!primaryProvider) {
      primaryProvider = 'ollama-api'
      console.log('✅ Ollama API configuré comme provider principal')
    } else {
      fallbackProvider = 'ollama-api'
      console.log('✅ Ollama API configuré comme fallback')
    }
  }

  // Essayer Ollama (local) comme fallback ou principal
  const ollamaOk = await ollama.initOllama()
  if (ollamaOk) {
    if (!primaryProvider) {
      primaryProvider = 'ollama'
      console.log('✅ Ollama configuré comme provider principal')
    } else if (!fallbackProvider) {
      fallbackProvider = 'ollama'
      console.log('✅ Ollama configuré comme fallback')
    } else {
      secondFallbackProvider = 'ollama'
      console.log('✅ Ollama configuré comme second fallback')
    }
  }

  if (!primaryProvider) {
    console.warn('⚠️ Aucun provider AI disponible !')
  }

  return primaryProvider !== null
}

/**
 * Vérifie si l'IA est disponible
 */
export function isAIAvailable() {
  return primaryProvider !== null
}

/**
 * Retourne le provider actuel
 */
export function getCurrentProvider() {
  return primaryProvider
}

const MAX_RETRIES = 2

/**
 * Exécute une fonction avec retry et fallback automatique
 */
async function withFallback(fnName, ...args) {
  const tryProvider = async (provider, providerName, retries = MAX_RETRIES) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await provider[fnName](...args)
      } catch (error) {
        console.warn(`⚠️ ${providerName} ${fnName} tentative ${attempt}/${retries} échouée:`, error.message)
        if (attempt === retries) throw error
        console.log(`🔄 Retry ${fnName}...`)
      }
    }
  }

  // Essayer le provider principal
  if (primaryProvider === 'openrouter') {
    try {
      return await tryProvider(openrouter, 'OpenRouter')
    } catch (error) {
      // Fallback vers Ollama API
      if (fallbackProvider === 'ollama-api') {
        console.log(`🔄 Fallback vers Ollama API pour ${fnName}...`)
        try {
          return await tryProvider(ollamaAPI, 'Ollama API')
        } catch (ollamaAPIError) {
          // Fallback vers Ollama local
          if (secondFallbackProvider === 'ollama') {
            console.log(`🔄 Fallback vers Ollama local pour ${fnName}...`)
            try {
              return await tryProvider(ollama, 'Ollama')
            } catch (ollamaError) {
              console.error(`❌ Tous les providers ont échoué pour ${fnName}`)
              throw ollamaError
            }
          }
          throw ollamaAPIError
        }
      } else if (fallbackProvider === 'ollama') {
        // Fallback direct vers Ollama local
        console.log(`🔄 Fallback vers Ollama local pour ${fnName}...`)
        try {
          return await tryProvider(ollama, 'Ollama')
        } catch (ollamaError) {
          console.error(`❌ Tous les providers ont échoué pour ${fnName}`)
          throw ollamaError
        }
      }
      throw error
    }
  } else if (primaryProvider === 'ollama-api') {
    try {
      return await tryProvider(ollamaAPI, 'Ollama API')
    } catch (error) {
      // Fallback vers Ollama local
      if (fallbackProvider === 'ollama') {
        console.log(`🔄 Fallback vers Ollama local pour ${fnName}...`)
        try {
          return await tryProvider(ollama, 'Ollama')
        } catch (ollamaError) {
          console.error(`❌ Tous les providers ont échoué pour ${fnName}`)
          throw ollamaError
        }
      }
      throw error
    }
  } else if (primaryProvider === 'ollama') {
    return await tryProvider(ollama, 'Ollama')
  }

  throw new Error('Aucun provider AI disponible')
}

/**
 * Génère du texte
 */
export async function generateText(prompt, options = {}) {
  return withFallback('generateText', prompt, options)
}

/**
 * Génère des questions GuessLink
 */
export async function generateQuestions(theme = null, count = 10) {
  return withFallback('generateQuestions', theme, count)
}

/**
 * Vérifie si deux réponses matchent
 */
export async function checkAnswerMatch(answer1, answer2, question) {
  return withFallback('checkAnswerMatch', answer1, answer2, question)
}

/**
 * Génère un commentaire de round (avec fallback de secours)
 */
export async function generateRoundComment(question, player1Name, answer1, player2Name, answer2, isMatch) {
  try {
    return await withFallback('generateRoundComment', question, player1Name, answer1, player2Name, answer2, isMatch)
  } catch (error) {
    console.error('❌ Tous les providers ont échoué pour le commentaire, fallback par défaut')
    return isMatch
      ? `${player1Name} et ${player2Name}, vous êtes connectés ! 🧠`
      : `${player1Name} dit "${answer1}", ${player2Name} dit "${answer2}"... Raté ! 😅`
  }
}

/**
 * Génère des questions de quiz
 */
export async function generateQuizQuestions(theme = null, count = 10, difficulty = 'medium') {
  return withFallback('generateQuizQuestions', theme, count, difficulty)
}

/**
 * Vérifie une réponse de quiz
 */
export async function checkQuizAnswer(playerAnswer, correctAnswer, question) {
  return withFallback('checkQuizAnswer', playerAnswer, correctAnswer, question)
}

/**
 * Génère un commentaire de quiz (avec fallback de secours)
 */
export async function generateQuizComment(question, correctAnswer, player1Name, player1Answer, player1Correct, player2Name, player2Answer, player2Correct) {
  try {
    return await withFallback('generateQuizComment', question, correctAnswer, player1Name, player1Answer, player1Correct, player2Name, player2Answer, player2Correct)
  } catch (error) {
    console.error('❌ Tous les providers ont échoué pour le commentaire, fallback par défaut')
    // Fallback de secours si tout échoue
    if (player1Correct && player2Correct) {
      return `${player1Name} et ${player2Name}, vous êtes des génies ! 🧠`
    } else if (!player1Correct && !player2Correct) {
      return `Aïe... ${player1Name} et ${player2Name}, c'était "${correctAnswer}" ! 📚`
    } else if (player1Correct) {
      return `Bravo ${player1Name} ! ${player2Name}, la prochaine fois peut-être ? 😅`
    } else {
      return `Bravo ${player2Name} ! ${player1Name}, la prochaine fois peut-être ? 😅`
    }
  }
}

export default {
  initAI,
  isAIAvailable,
  getCurrentProvider,
  generateText,
  generateQuestions,
  checkAnswerMatch,
  generateRoundComment,
  generateQuizQuestions,
  checkQuizAnswer,
  generateQuizComment,
}
