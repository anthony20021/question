/**
 * Service Ollama AI (Local)
 * Documentation: https://ollama.com
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct'

let isInitialized = false

/**
 * Initialise Ollama (vérifie que le serveur répond)
 */
export async function initOllama() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`)
    if (response.ok) {
      const data = await response.json()
      const models = data.models?.map(m => m.name) || []
      console.log(`🦙 Ollama connecté - Modèles disponibles: ${models.join(', ')}`)
      isInitialized = true
      return true
    }
  } catch (error) {
    console.warn('⚠️ Ollama non disponible:', error.message)
  }
  return false
}

/**
 * Vérifie si Ollama est disponible
 */
export function isOllamaAvailable() {
  return isInitialized
}

/**
 * Génère du texte avec Ollama
 */
export async function generateText(prompt, options = {}) {
  const startTime = Date.now()
  const promptPreview = prompt.substring(0, 50).replace(/\n/g, ' ')
  console.log(`🦙 Ollama: requête en cours... "${promptPreview}..."`)
  
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 256,
      }
    })
  })

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  if (!response.ok) {
    console.error(`🦙 Ollama: erreur ${response.status} après ${elapsed}s`)
    throw new Error(`Ollama error: ${response.status}`)
  }

  const data = await response.json()
  const responsePreview = data.response?.substring(0, 100).replace(/\n/g, ' ') || '(vide)'
  console.log(`🦙 Ollama: réponse reçue en ${elapsed}s - "${responsePreview}..."`)
  
  return data.response
}

/**
 * Génère des questions pour le jeu GuessLink
 */
export async function generateQuestions(theme = null, count = 10) {
  let prompt = `Génère ${count} questions originales pour un jeu où 2 joueurs doivent trouver des points communs.
Les questions doivent être du type "Quel est ton/ta ... préféré(e) ?" ou "Quelle est ta ... préférée ?"
Exemples: "Quel est ton film préféré ?", "Quelle est ta pizza préférée ?"`

  if (theme) {
    prompt += `\n\nThème: ${theme}`
  }

  prompt += `\n\nRéponds uniquement avec un tableau JSON de questions, sans explication.
Format: ["Question 1 ?", "Question 2 ?", ...]`

  const response = await generateText(prompt, { temperature: 0.8 })
  console.log('🦙 Ollama generateQuestions: parsing JSON...')
  
  const jsonMatch = response.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    try {
      const questions = JSON.parse(jsonMatch[0])
      console.log(`🦙 Ollama generateQuestions: ${questions.length} questions parsées ✅`)
      return questions
    } catch (parseError) {
      console.error('❌ Ollama JSON invalide:', jsonMatch[0].substring(0, 200))
      throw parseError
    }
  }
  
  console.error('❌ Ollama: pas de JSON trouvé dans la réponse')
  throw new Error('Pas de JSON dans la réponse Ollama')
}

/**
 * Vérifie si deux réponses sont similaires
 */
export async function checkAnswerMatch(answer1, answer2, question) {
  const prompt = `Question posée: "${question}"
Réponse joueur 1: "${answer1}"
Réponse joueur 2: "${answer2}"

Ces deux réponses désignent-elles la même chose ou sont-elles très similaires ?
Réponds en JSON: {"match": true/false, "explanation": "courte explication"}`

  try {
    const response = await generateText(prompt, { temperature: 0.3 })
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return { match: false, explanation: 'Erreur d\'analyse' }
  } catch (error) {
    console.error('❌ Erreur Ollama checkAnswerMatch:', error.message)
    return { match: false, explanation: 'Erreur' }
  }
}

/**
 * Génère un commentaire fun sur le résultat d'une manche
 */
export async function generateRoundComment(question, player1Name, answer1, player2Name, answer2, isMatch) {
  const context = isMatch 
    ? `${player1Name} et ${player2Name} ont MATCHÉ avec "${answer1}" et "${answer2}"`
    : `PAS DE MATCH: ${player1Name} a dit "${answer1}", ${player2Name} a dit "${answer2}"`

  const prompt = `Tu es un humoriste. ${context}
Écris UNE phrase drôle (max 15 mots) qui chambre gentiment les joueurs.
Utilise leurs prénoms. Pas d'explication, juste la blague.`

  try {
    const response = await generateText(prompt, { temperature: 1.0, maxTokens: 40 })
    return response.trim().replace(/^["'«]|["'»]$/g, '')
  } catch (error) {
    return isMatch 
      ? `${player1Name} et ${player2Name}, vous êtes connectés ! 🧠`
      : `${player1Name} dit "${answer1}", ${player2Name} dit "${answer2}"... Aïe ! 😅`
  }
}

/**
 * Génère des questions de quiz
 */
export async function generateQuizQuestions(theme = null, count = 10) {
  let prompt = `Génère ${count} questions de CULTURE GÉNÉRALE pour un quiz.
Les questions doivent avoir une RÉPONSE UNIQUE et VÉRIFIABLE.`

  if (theme) {
    prompt += `\n\nThème: ${theme}`
  }

  prompt += `\n\nRéponds UNIQUEMENT avec un tableau JSON:
[{"question": "Question ?", "answer": "Réponse"}, ...]`

  const response = await generateText(prompt, { temperature: 0.8 })
  console.log('🦙 Ollama generateQuizQuestions: parsing JSON...')
  
  const jsonMatch = response.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    try {
      const questions = JSON.parse(jsonMatch[0])
      console.log(`🦙 Ollama generateQuizQuestions: ${questions.length} questions parsées ✅`)
      return questions
    } catch (parseError) {
      console.error('❌ Ollama JSON invalide:', jsonMatch[0].substring(0, 200))
      throw parseError
    }
  }
  
  console.error('❌ Ollama: pas de JSON trouvé dans la réponse')
  throw new Error('Pas de JSON dans la réponse Ollama')
}

/**
 * Vérifie si une réponse de quiz est correcte
 */
export async function checkQuizAnswer(playerAnswer, correctAnswer, question) {
  const prompt = `Question: "${question}"
Bonne réponse: "${correctAnswer}"
Réponse du joueur: "${playerAnswer}"

La réponse est-elle correcte ? (tolérer les fautes mineures)
Réponds UNIQUEMENT: {"correct": true} ou {"correct": false}`

  try {
    const response = await generateText(prompt, { temperature: 0.2 })
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return { correct: false }
  } catch (error) {
    const normalize = (s) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return { correct: normalize(playerAnswer) === normalize(correctAnswer) }
  }
}

/**
 * Génère un commentaire fun pour le quiz
 */
export async function generateQuizComment(question, correctAnswer, player1Name, player1Answer, player1Correct, player2Name, player2Answer, player2Correct) {
  let situation = ''
  if (player1Correct && player2Correct) situation = 'Les deux ont bon'
  else if (!player1Correct && !player2Correct) situation = 'Les deux ont faux'
  else if (player1Correct) situation = `${player1Name} a bon, ${player2Name} a faux`
  else situation = `${player2Name} a bon, ${player1Name} a faux`

  const prompt = `Quiz entre ${player1Name} et ${player2Name}. ${situation}.
Bonne réponse: "${correctAnswer}"
Écris UNE phrase drôle (15 mots max) qui chambre gentiment. Pas d'explication.`

  try {
    const response = await generateText(prompt, { temperature: 0.9, maxTokens: 40 })
    return response.trim().replace(/^["'«]|["'»]$/g, '')
  } catch (error) {
    if (player1Correct && player2Correct) {
      return `${player1Name} et ${player2Name}, vous êtes des génies ! 🧠`
    } else if (!player1Correct && !player2Correct) {
      return `Aïe... ${player1Name} et ${player2Name}, c'était "${correctAnswer}" ! 📚`
    } else if (player1Correct) {
      return `Bravo ${player1Name} ! ${player2Name}, on révise ce soir ? 😅`
    } else {
      return `Bravo ${player2Name} ! ${player1Name}, on révise ce soir ? 😅`
    }
  }
}

export default {
  initOllama,
  isOllamaAvailable,
  generateText,
  generateQuestions,
  checkAnswerMatch,
  generateRoundComment,
  generateQuizQuestions,
  checkQuizAnswer,
  generateQuizComment,
}
