/**
 * Service AI unifié avec fallback
 * OpenRouter (cloud) → Ollama (local)
 */

import * as openrouter from './openrouter.js'
import * as ollama from './ollama.js'

let primaryProvider = null  // 'openrouter' | 'ollama' | null
let fallbackProvider = null // 'ollama' | null

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
  
  // Essayer Ollama (local) comme fallback ou principal
  const ollamaOk = await ollama.initOllama()
  if (ollamaOk) {
    if (!primaryProvider) {
      primaryProvider = 'ollama'
      console.log('✅ Ollama configuré comme provider principal')
    } else {
      fallbackProvider = 'ollama'
      console.log('✅ Ollama configuré comme fallback')
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

/**
 * Exécute une fonction avec fallback automatique
 */
async function withFallback(fnName, ...args) {
  // Essayer le provider principal
  if (primaryProvider === 'openrouter') {
    try {
      return await openrouter[fnName](...args)
    } catch (error) {
      console.warn(`⚠️ OpenRouter ${fnName} échoué:`, error.message)
      
      // Fallback vers Ollama
      if (fallbackProvider === 'ollama') {
        console.log(`🔄 Fallback vers Ollama pour ${fnName}...`)
        try {
          return await ollama[fnName](...args)
        } catch (ollamaError) {
          console.error(`❌ Ollama ${fnName} aussi échoué:`, ollamaError.message)
          throw ollamaError
        }
      }
      throw error
    }
  } else if (primaryProvider === 'ollama') {
    return await ollama[fnName](...args)
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
 * Génère un commentaire de round
 */
export async function generateRoundComment(question, player1Name, answer1, player2Name, answer2, isMatch) {
  return withFallback('generateRoundComment', question, player1Name, answer1, player2Name, answer2, isMatch)
}

/**
 * Génère des questions de quiz
 */
export async function generateQuizQuestions(theme = null, count = 10) {
  return withFallback('generateQuizQuestions', theme, count)
}

/**
 * Vérifie une réponse de quiz
 */
export async function checkQuizAnswer(playerAnswer, correctAnswer, question) {
  return withFallback('checkQuizAnswer', playerAnswer, correctAnswer, question)
}

/**
 * Génère un commentaire de quiz
 */
export async function generateQuizComment(question, correctAnswer, player1Name, player1Answer, player1Correct, player2Name, player2Answer, player2Correct) {
  return withFallback('generateQuizComment', question, correctAnswer, player1Name, player1Answer, player1Correct, player2Name, player2Answer, player2Correct)
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
