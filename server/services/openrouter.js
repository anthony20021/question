/**
 * Service OpenRouter AI
 * Documentation: https://openrouter.ai/docs
 * SDK: @openrouter/sdk
 */

import { OpenRouter } from '@openrouter/sdk'

// Configuration
const API_KEY = process.env.OPENROUTER_API_KEY
const MODEL_NAME = 'nousresearch/hermes-3-llama-3.1-405b:free' // Modèle rapide et pas cher

let openRouter = null

/**
 * Initialise le client OpenRouter
 */
export function initAI() {
  if (!API_KEY) {
    console.warn('⚠️ OPENROUTER_API_KEY non définie dans .env')
    return false
  }
  
  openRouter = new OpenRouter({
    apiKey: API_KEY,
    defaultHeaders: {
      'HTTP-Referer': 'https://guesslink.app',
      'X-Title': 'GuessLink',
    },
  })
  
  console.log('✨ OpenRouter AI initialisé')
  return true
}

/**
 * Vérifie si l'IA est disponible
 */
export function isAIAvailable() {
  return openRouter !== null
}

/**
 * Génère du texte simple
 * @param {string} prompt - Le prompt à envoyer
 * @param {object} options - Options (temperature, maxTokens)
 * @returns {Promise<string>} - La réponse générée
 */
export async function generateText(prompt, options = {}) {
  if (!openRouter) {
    throw new Error('OpenRouter non initialisé')
  }
  
  try {
    const completion = await openRouter.chat.send({
      model: MODEL_NAME,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
      stream: false,
    })
    
    return completion.choices[0].message.content
  } catch (error) {
    console.error('❌ Erreur OpenRouter:', error.message)
    console.error('   Détails:', JSON.stringify(error.response?.data || error, null, 2))
    throw error
  }
}

/**
 * Génère des questions pour le jeu GuessLink
 * @param {string} theme - Thème optionnel
 * @param {number} count - Nombre de questions
 * @returns {Promise<string[]>}
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
  const jsonMatch = response.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }
  return []
}

/**
 * Vérifie si deux réponses sont similaires (avec IA)
 * @param {string} answer1 
 * @param {string} answer2 
 * @param {string} question - La question posée
 * @returns {Promise<{match: boolean, explanation: string}>}
 */
export async function checkAnswerMatch(answer1, answer2, question) {
  const prompt = `Question posée: "${question}"
Réponse joueur 1: "${answer1}"
Réponse joueur 2: "${answer2}"

Ces deux réponses désignent-elles la même chose ou sont-elles très similaires ?
Par exemple: "Harry Potter" et "harry potter" = OUI
"Pizza" et "pizza margherita" = OUI (assez proche)
"Bleu" et "Rouge" = NON

Réponds en JSON: {"match": true/false, "explanation": "courte explication"}`

  const response = await generateText(prompt, { temperature: 0.3 })
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }
  return { match: false, explanation: 'Erreur d\'analyse' }
}

/**
 * Génère un commentaire fun sur le résultat d'une manche
 * @param {string} question 
 * @param {string} player1Name - Nom du joueur 1
 * @param {string} answer1 
 * @param {string} player2Name - Nom du joueur 2
 * @param {string} answer2 
 * @param {boolean} isMatch 
 * @returns {Promise<string>}
 */
export async function generateRoundComment(question, player1Name, answer1, player2Name, answer2, isMatch) {
  let prompt
  
  if (isMatch) {
    prompt = `RÔLE: Tu es un HUMORISTE qui commente un jeu TV. Tu dois faire RIRE, pas expliquer.

CONTEXTE:
- ${player1Name} a répondu "${answer1}"
- ${player2Name} a répondu "${answer2}"  
- C'est un MATCH !

MISSION: Écris UNE SEULE phrase drôle (max 15 mots) en français qui:
✅ Utilise les prénoms ${player1Name} et ${player2Name}
✅ Se moque gentiment d'eux ou de leur réponse
✅ Fait une BLAGUE ou une PIQUE amicale

❌ INTERDIT: Pas d'explication, pas d'analyse, pas de "les deux réponses..."

EXEMPLES:
- "${player1Name} et ${player2Name}, même cerveau ou vous trichez ?"
- "Ah ${player1Name}, ${player2Name} est ton âme sœur niveau goûts douteux !"
- "${player2Name} a copié sur ${player1Name}, j'ai tout vu !"

TA RÉPONSE (juste la blague, rien d'autre):`
  } else {
    prompt = `RÔLE: Tu es un HUMORISTE qui commente un jeu TV. Tu dois faire RIRE, pas expliquer.

CONTEXTE:
- ${player1Name} a répondu "${answer1}"
- ${player2Name} a répondu "${answer2}"
- PAS DE MATCH !

MISSION: Écris UNE SEULE phrase drôle (max 15 mots) en français qui:
✅ Utilise les prénoms ${player1Name} et ${player2Name}
✅ Chambre l'un des deux (ou les deux) sur leur réponse
✅ Fait une VANNE sur leur désaccord

❌ INTERDIT: Pas d'explication, pas d'analyse, pas de comparaison sérieuse

EXEMPLES:
- "${player1Name} dit '${answer1}'... ${player2Name}, tu le connais vraiment ?"
- "Wow ${player2Name}, '${answer2}' ? On va en reparler après..."
- "${player1Name} et ${player2Name}, vous vivez sur la même planète ou pas ?"

TA RÉPONSE (juste la vanne, rien d'autre):`
  }

  const response = await generateText(prompt, { temperature: 1.0, maxTokens: 40 })
  // Nettoyer la réponse - enlever les guillemets et préfixes potentiels
  let comment = response.trim()
  comment = comment.replace(/^["'«]|["'»]$/g, '')
  comment = comment.replace(/^(Commentaire|Blague|Vanne|Réponse)\s*:\s*/i, '')
  return comment
}

/**
 * Génère des questions de quiz culture générale avec réponses
 * @param {string} theme - Thème optionnel
 * @param {number} count - Nombre de questions
 * @param {string} difficulty - Niveau de difficulté (easy, medium, hard)
 * @returns {Promise<Array<{question: string, answer: string}>>}
 */
export async function generateQuizQuestions(theme = null, count = 10, difficulty = 'medium') {
  const difficultyInstructions = {
    easy: 'Questions FACILES, réponses connues de tous, niveau collège.',
    medium: 'Questions de difficulté MOYENNE, culture générale standard.',
    hard: 'Questions DIFFICILES pour experts, détails pointus, dates précises.'
  }
  
  let prompt = `Génère ${count} questions de CULTURE GÉNÉRALE pour un quiz entre amis.
Les questions doivent avoir une RÉPONSE UNIQUE et VÉRIFIABLE.
Varie les domaines : histoire, géographie, sciences, cinéma, musique, sport, etc.

DIFFICULTÉ: ${difficultyInstructions[difficulty] || difficultyInstructions.medium}`

  if (theme) {
    prompt += `\n\nThème principal: ${theme}`
  }

  prompt += `\n\nRéponds UNIQUEMENT avec un tableau JSON, sans explication.
Format EXACT:
[
  {"question": "Question 1 ?", "answer": "Réponse 1"},
  {"question": "Question 2 ?", "answer": "Réponse 2"}
]`

  const response = await generateText(prompt, { temperature: 0.8 })
  const jsonMatch = response.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }
  return []
}

/**
 * Vérifie si une réponse de quiz est correcte
 * @param {string} playerAnswer - Réponse du joueur
 * @param {string} correctAnswer - Bonne réponse
 * @param {string} question - La question posée
 * @returns {Promise<{correct: boolean}>}
 */
export async function checkQuizAnswer(playerAnswer, correctAnswer, question) {
  const prompt = `Tu es un correcteur de quiz. Vérifie si la réponse du joueur est correcte.

Question: "${question}"
Bonne réponse: "${correctAnswer}"
Réponse du joueur: "${playerAnswer}"

ACCEPTER si:
✅ Même réponse avec fautes d'orthographe
✅ Synonyme ou variante (ex: "USA" = "États-Unis")  
✅ Approximation numérique raisonnable (ex: "300 000" ≈ "299792")
✅ Arrondi acceptable

REFUSER si:
❌ Réponse complètement différente
❌ "Je sais pas", "aucune idée", "je comprends pas", "?" ou réponse vide
❌ Réponse au hasard sans rapport

La réponse "${playerAnswer}" correspond-elle à "${correctAnswer}" ?
Réponds: {"correct": true} ou {"correct": false}`

  const response = await generateText(prompt, { temperature: 0.2 })
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }
  return { correct: false }
}

/**
 * Génère un commentaire fun pour le quiz
 * @param {string} question 
 * @param {string} correctAnswer 
 * @param {string} player1Name 
 * @param {string} player1Answer 
 * @param {boolean} player1Correct 
 * @param {string} player2Name 
 * @param {string} player2Answer 
 * @param {boolean} player2Correct 
 * @returns {Promise<string>}
 */
export async function generateQuizComment(question, correctAnswer, player1Name, player1Answer, player1Correct, player2Name, player2Answer, player2Correct) {
  let situation
  if (player1Correct && player2Correct) {
    situation = 'LES DEUX ONT BON'
  } else if (!player1Correct && !player2Correct) {
    situation = 'LES DEUX ONT FAUX'
  } else if (player1Correct) {
    situation = `${player1Name} A BON, ${player2Name} A FAUX`
  } else {
    situation = `${player2Name} A BON, ${player1Name} A FAUX`
  }

  const prompt = `Tu commentes un quiz entre EXACTEMENT 2 joueurs: "${player1Name}" et "${player2Name}". PAS D'AUTRES JOUEURS.

${situation}
- ${player1Name} a répondu: "${player1Answer}" ${player1Correct ? '✅' : '❌'}
- ${player2Name} a répondu: "${player2Answer}" ${player2Correct ? '✅' : '❌'}
- Bonne réponse: "${correctAnswer}"

Écris UNE SEULE phrase drôle (15 mots MAX) qui se moque clairement.
UTILISE UNIQUEMENT les noms ${player1Name} et ${player2Name}. N'INVENTE PAS d'autres personnes.

Réponse (juste la phrase, sans guillemets):`

  const response = await generateText(prompt, { temperature: 0.9, maxTokens: 40 })
  let comment = response.trim()
  comment = comment.replace(/^["'«]|["'»]$/g, '')
  // Tronquer si trop long
  if (comment.length > 150) {
    comment = comment.substring(0, 150) + '...'
  }
  return comment
}

export default {
  initAI,
  isAIAvailable,
  generateText,
  generateQuestions,
  checkAnswerMatch,
  generateRoundComment,
  generateQuizQuestions,
  checkQuizAnswer,
  generateQuizComment,
}

