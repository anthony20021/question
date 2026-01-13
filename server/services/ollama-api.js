/**
 * Service Ollama API (API maison)
 * API REST pour interroger une instance Ollama distante
 */

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://87.91.77.59:3000'
const OLLAMA_API_TOKEN = process.env.OLLAMA_API_TOKEN
const OLLAMA_API_MODEL = process.env.OLLAMA_API_MODEL || 'nemotron-3-nano:latest'

let isInitialized = false

/**
 * Initialise l'API Ollama (vérifie que le serveur répond)
 */
export async function initOllamaAPI() {
    try {
        // Vérifier le health check (route publique)
        const response = await fetch(`${OLLAMA_API_URL}/health`)
        if (response.ok) {
            console.log(`🌐 Ollama API connectée: ${OLLAMA_API_URL}`)
            isInitialized = true
            return true
        }
    } catch (error) {
        console.warn('⚠️ Ollama API non disponible:', error.message)
    }
    return false
}

/**
 * Vérifie si l'API Ollama est disponible
 */
export function isOllamaAPIAvailable() {
    return isInitialized
}

/**
 * Fait une requête authentifiée à l'API
 */
async function makeAuthenticatedRequest(endpoint, body) {
    const headers = {
        'Content-Type': 'application/json',
    }

    // Ajouter le token si disponible
    if (OLLAMA_API_TOKEN) {
        headers['Authorization'] = `Bearer ${OLLAMA_API_TOKEN}`
    }

    const response = await fetch(`${OLLAMA_API_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Ollama API erreur ${response.status}:`, errorText)
        throw new Error(`Ollama API error: ${response.status}`)
    }

    return response.json()
}

/**
 * Génère du texte avec l'API Ollama
 */
export async function generateText(prompt, options = {}) {
    const startTime = Date.now()
    const promptPreview = prompt.substring(0, 50).replace(/\n/g, ' ')
    console.log(`🌐 Ollama API: requête en cours... "${promptPreview}..."`)

    const data = await makeAuthenticatedRequest('/api/generate', {
        model: OLLAMA_API_MODEL,
        prompt: prompt,
        stream: false,
        options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens ?? 256,
        }
    })

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`🌐 Ollama API: réponse reçue en ${elapsed}s:`)
    console.log('--- RÉPONSE OLLAMA API ---')
    console.log(data.response || '(vide)')
    console.log('--- FIN RÉPONSE ---')

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

    const response = await generateText(prompt, { temperature: 0.8, maxTokens: 2048 })
    console.log('🌐 Ollama API generateQuestions: recherche JSON dans la réponse...')
    console.log('📝 Réponse brute reçue:')
    console.log('='.repeat(50))
    console.log(response)
    console.log('='.repeat(50))

    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
        console.log('✅ JSON trouvé, tentative de parsing...')
        try {
            const questions = JSON.parse(jsonMatch[0])
            console.log(`🌐 Ollama API generateQuestions: ${questions.length} questions parsées ✅`)
            return questions
        } catch (parseError) {
            console.error('❌ Erreur parsing JSON:', parseError.message)
            console.error('JSON extrait:')
            console.error(jsonMatch[0])
            throw parseError
        }
    }

    console.error('❌ Aucun tableau JSON [ ] trouvé dans la réponse ci-dessus')
    throw new Error('Pas de JSON dans la réponse Ollama API')
}

/**
 * Vérifie si deux réponses sont similaires
 */
export async function checkAnswerMatch(answer1, answer2, question) {
    const prompt = `Tu es un expert en détection de correspondances intelligentes. Ton but est de trouver si deux réponses désignent la MÊME CHOSE, même si elles sont formulées différemment.

Question: "${question}"
Réponse 1: "${answer1}"
Réponse 2: "${answer2}"

RÈGLES DE MATCH (sois INTELLIGENT et GÉNÉREUX):

✅ MATCH si:
- Réponses identiques (même si orthographe différente)
- Un nom spécifique = sa description détaillée
  Exemples:
  * "salade césar" = "salade avec poulet et sauce" (la césar contient ces éléments)
  * "pizza margherita" = "pizza tomate mozzarella"
  * "hamburger" = "burger avec pain et viande"
- Synonymes ou variantes (ex: "McDo" = "McDonald's")
- Même concept exprimé différemment

❌ PAS DE MATCH si:
- Réponses vraiment différentes (ex: "pizza" vs "sushi")
- Concepts opposés

IMPORTANT: Si une réponse décrit les INGRÉDIENTS ou COMPOSANTS d'une autre réponse, c'est un MATCH !

Réponds UNIQUEMENT en JSON: {"match": true/false, "explanation": "courte explication"}`

    try {
        const response = await generateText(prompt, { temperature: 0.3 })
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0])
        }
        return { match: false, explanation: 'Erreur d\'analyse' }
    } catch (error) {
        console.error('❌ Erreur Ollama API checkAnswerMatch:', error.message)
        return { match: false, explanation: 'Erreur' }
    }
}

/**
 * Génère un commentaire fun sur le résultat d'une manche
 */
export async function generateRoundComment(question, player1Name, answer1, player2Name, answer2, isMatch) {
    let prompt

    if (isMatch) {
        prompt = `MATCH ! ${player1Name} et ${player2Name} ont répondu la même chose (ou très similaire) : "${answer1}" et "${answer2}".

IMPORTANT: C'est un MATCH, donc célèbre leur connexion, leur complicité, leur synchronisation.

Exemples de commentaires drôles pour un MATCH:
- "${player1Name} et ${player2Name}, même cerveau ou vous trichez ?"
- "Télépathie confirmée ! Flippant..."
- "Vous avez répété avant ou quoi ?"
- "Même longueur d'onde, même goûts, même cerveau !"

Écris UNE phrase drôle et originale (différente des exemples) qui célèbre leur MATCH. Max 15 mots. Pas de guillemets.`
    } else {
        prompt = `PAS DE MATCH ! ${player1Name} a répondu "${answer1}", ${player2Name} a répondu "${answer2}" - Réponses DIFFÉRENTES.

IMPORTANT: Ce n'est PAS un match, donc chambre gentiment leur désaccord, leur incompatibilité, leur différence.

Exemples de commentaires drôles pour un NON-MATCH:
- "${player1Name} dit "${answer1}", ${player2Name} dit "${answer2}"... Vous vous connaissez vraiment ?"
- "L'incompatibilité totale ! C'est beau."
- "Chacun dans son monde, j'adore."
- "Deux goûts, deux couleurs, zéro point commun !"

Écris UNE phrase drôle et originale (différente des exemples) qui chambre leur NON-MATCH. Max 15 mots. Pas de guillemets.`
    }

    try {
        console.log(`🌐 Ollama API: génération commentaire round...`)
        const response = await generateText(prompt, { temperature: 1.0, maxTokens: 50 })
        const comment = response.trim().replace(/^["'«]|["'»]$/g, '').replace(/\n/g, ' ')
        console.log(`🌐 Ollama API commentaire: "${comment}"`)
        return comment
    } catch (error) {
        console.error('❌ Ollama API generateRoundComment error:', error.message)
        return isMatch
            ? `${player1Name} et ${player2Name}, vous êtes connectés ! 🧠`
            : `${player1Name} dit "${answer1}", ${player2Name} dit "${answer2}"... Aïe ! 😅`
    }
}

/**
 * Génère des questions de quiz
 */
export async function generateQuizQuestions(theme = null, count = 10, difficulty = 'medium') {
    const difficultyInstructions = {
        easy: 'Questions FACILES, réponses connues de tous, niveau collège.',
        medium: 'Questions de difficulté MOYENNE, culture générale standard.',
        hard: 'Questions DIFFICILES pour experts, détails pointus, dates précises.'
    }

    let prompt = `Génère ${count} questions de CULTURE GÉNÉRALE pour un quiz.
Les questions doivent avoir une RÉPONSE UNIQUE et VÉRIFIABLE.

DIFFICULTÉ: ${difficultyInstructions[difficulty] || difficultyInstructions.medium}`

    if (theme) {
        prompt += `\n\nThème: ${theme}`
    }

    prompt += `\n\nRéponds UNIQUEMENT avec un tableau JSON:
[{"question": "Question ?", "answer": "Réponse"}, ...]`

    const response = await generateText(prompt, { temperature: 0.8, maxTokens: 2048 })
    console.log('🌐 Ollama API generateQuizQuestions: recherche JSON dans la réponse...')
    console.log('📝 Réponse brute reçue:')
    console.log('='.repeat(50))
    console.log(response)
    console.log('='.repeat(50))

    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
        console.log('✅ JSON trouvé, tentative de parsing...')
        try {
            const questions = JSON.parse(jsonMatch[0])
            console.log(`🌐 Ollama API generateQuizQuestions: ${questions.length} questions parsées ✅`)
            return questions
        } catch (parseError) {
            console.error('❌ Erreur parsing JSON:', parseError.message)
            console.error('JSON extrait:')
            console.error(jsonMatch[0])
            throw parseError
        }
    }

    console.error('❌ Aucun tableau JSON [ ] trouvé dans la réponse ci-dessus')
    throw new Error('Pas de JSON dans la réponse Ollama API')
}

/**
 * Vérifie si une réponse de quiz est correcte
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
    let examples = ''

    if (player1Correct && player2Correct) {
        situation = `${player1Name} et ${player2Name} ont tous les deux trouvé "${correctAnswer}"`
        examples = `Exemples de réponses possibles:
- "${player1Name} et ${player2Name}, vous avez Google dans la tête ou quoi ?"
- "Double combo gagnant ! Vous me faites peur là..."
- "OK les intellos, on se calme !"`
    } else if (!player1Correct && !player2Correct) {
        situation = `${player1Name} a dit "${player1Answer}", ${player2Name} a dit "${player2Answer}", mais c'était "${correctAnswer}"`
        examples = `Exemples de réponses possibles:
- "${player1Answer}" et "${player2Answer}"... Vous étiez où pendant les cours ?
- "Double fail ! La honte internationale !"
- "Même en équipe vous trouvez pas, c'est grave..."`
    } else if (player1Correct) {
        situation = `${player1Name} a trouvé "${correctAnswer}", mais ${player2Name} a dit "${player2Answer}"`
        examples = `Exemples de réponses possibles:
- "${player1Name} assure ! ${player2Name}, "${player2Answer}" sérieux ?"
- "${player2Name} a pris un sacré vent là..."
- "1 partout, la balle au centre ! Enfin presque..."`
    } else {
        situation = `${player2Name} a trouvé "${correctAnswer}", mais ${player1Name} a dit "${player1Answer}"`
        examples = `Exemples de réponses possibles:
- "${player2Name} en mode Einstein ! ${player1Name}... on en parle ?"
- "${player1Name}, "${player1Answer}" ? T'as fumé quoi ?"
- "Victoire écrasante de ${player2Name} sur ce coup !"`
    }

    const prompt = `Tu commentes un quiz entre amis. ${situation}.

${examples}

Écris UNE SEULE phrase drôle et originale (différente des exemples). Maximum 20 mots. Pas de guillemets.`

    console.log(`🌐 Ollama API: génération commentaire quiz...`)
    console.log(`📝 Situation: ${situation}`)

    const response = await generateText(prompt, { temperature: 1.0, maxTokens: 60 })
    const comment = response.trim().replace(/^["'«]|["'»]$/g, '').replace(/\n/g, ' ')
    console.log(`🌐 Ollama API commentaire généré: "${comment}"`)

    // Si le commentaire est vide ou trop court, on throw pour retry
    if (!comment || comment.length < 5) {
        throw new Error('Commentaire vide ou trop court')
    }

    return comment
}

export default {
    initOllamaAPI,
    isOllamaAPIAvailable,
    generateText,
    generateQuestions,
    checkAnswerMatch,
    generateRoundComment,
    generateQuizQuestions,
    checkQuizAnswer,
    generateQuizComment,
}
