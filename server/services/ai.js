/**
 * Service AI unifié avec fallback
 * Ollama API (serveur distant) → OpenRouter (cloud) → Ollama (local)
 */

import * as openrouter from './openrouter.js'
import * as ollamaAPI from './ollama-api.js'
import * as ollama from './ollama.js'

let primaryProvider = null  // 'ollama-api' | 'openrouter' | 'ollama' | null
let fallbackProvider = null // 'openrouter' | 'ollama' | null
let secondFallbackProvider = null // 'ollama' | null

/**
 * Initialise les services AI
 */
export async function initAI() {
  console.log('🤖 Initialisation des services AI...')

  // Essayer Ollama API (serveur distant) en priorité
  const ollamaAPIOk = await ollamaAPI.initOllamaAPI()
  if (ollamaAPIOk) {
    primaryProvider = 'ollama-api'
    console.log('✅ Ollama API configuré comme provider principal')
  }

  // Essayer OpenRouter comme fallback ou principal
  const openrouterOk = openrouter.initAI()
  if (openrouterOk) {
    if (!primaryProvider) {
      primaryProvider = 'openrouter'
      console.log('✅ OpenRouter configuré comme provider principal')
    } else {
      fallbackProvider = 'openrouter'
      console.log('✅ OpenRouter configuré comme fallback')
    }
  }

  // Essayer Ollama (local) comme dernier fallback
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
  if (primaryProvider === 'ollama-api') {
    try {
      return await tryProvider(ollamaAPI, 'Ollama API')
    } catch (error) {
      // Fallback vers OpenRouter
      if (fallbackProvider === 'openrouter') {
        console.log(`🔄 Fallback vers OpenRouter pour ${fnName}...`)
        try {
          return await tryProvider(openrouter, 'OpenRouter')
        } catch (openrouterError) {
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
          throw openrouterError
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
  } else if (primaryProvider === 'openrouter') {
    try {
      return await tryProvider(openrouter, 'OpenRouter')
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
export async function generateRoundComment(question, player1Name, answer1, player2Name, answer2, isMatch, streakInfo = {}) {
  try {
    return await withFallback('generateRoundComment', question, player1Name, answer1, player2Name, answer2, isMatch, streakInfo)
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

/**
 * Génère un résumé/roast de fin de partie (avec fallback de secours)
 */
export async function generateGameSummary(player1Name, score1, player2Name, score2, totalQuestions, bestStreak, mode) {
  try {
    return await withFallback('generateGameSummary', player1Name, score1, player2Name, score2, totalQuestions, bestStreak, mode)
  } catch (error) {
    console.error('❌ Tous les providers ont échoué pour le résumé de partie, fallback par défaut')
    return score1 === score2
      ? `Égalité parfaite ${score1}/${totalQuestions} entre ${player1Name} et ${player2Name} ! 🤝`
      : `${score1 > score2 ? player1Name : player2Name} l'emporte ${Math.max(score1, score2)}-${Math.min(score1, score2)} ! 🏆`
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
  generateGameSummary,
}
