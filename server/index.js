import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { 
  initAI, 
  isAIAvailable,
  getCurrentProvider,
  generateQuestions, 
  checkAnswerMatch, 
  generateRoundComment,
  generateQuizQuestions,
  checkQuizAnswer,
  generateQuizComment
} from './services/ai.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Charger les questions depuis le fichier JSON
const questionsData = JSON.parse(readFileSync(join(__dirname, '../src/data/questions.json'), 'utf-8'))
const allQuestions = questionsData.questions

// Initialiser les services AI (OpenRouter + Ollama fallback)
await initAI()

const PORT = process.env.PORT || 3001
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

const app = express()
app.use(cors({ 
  origin: FRONTEND_URL,
  methods: ["GET", "POST"]
}))
app.use(express.json())

const distPath = join(__dirname, '../dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
}

const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
  }
})

// Stockage des rooms en mémoire
const rooms = new Map()

// Mélange un tableau (Fisher-Yates shuffle)
function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Comparaison simple des réponses (mode classique)
function simpleAnswerMatch(answer1, answer2) {
  const a1 = answer1.toLowerCase().trim()
  const a2 = answer2.toLowerCase().trim()
  return a1 === a2 || a1.includes(a2) || a2.includes(a1)
}

io.on('connection', (socket) => {
  console.log('🔌 Nouveau joueur connecté:', socket.id)

  socket.on('join-room', ({ roomId, pseudo }) => {
    socket.join(roomId)
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { 
        players: [], 
        messages: [],
        creator: socket.id,
        gameStarted: false,
        mode: 'classic', // 'classic' ou 'ai'
        theme: null,
        questionsList: [],
        questionIndex: 0,
        currentQuestion: null,
        answers: {},
        scores: {},
        round: 0,
        totalQuestions: 0,
        isGenerating: false
      })
    }
    
    const room = rooms.get(roomId)
    const existingPlayer = room.players.find(p => p.id === socket.id)
    
    if (!existingPlayer && room.players.length < 2) {
      room.players.push({ id: socket.id, pseudo })
      room.scores[socket.id] = 0
    }
    
    io.to(roomId).emit('players-update', room.players)
    socket.emit('room-info', { 
      isCreator: room.creator === socket.id,
      gameStarted: room.gameStarted,
      mode: room.mode
    })
    socket.emit('chat-history', room.messages)
    
    // Si la partie a déjà commencé, envoyer l'état actuel
    if (room.gameStarted && room.currentQuestion) {
      socket.emit('game-started', { 
        question: room.currentQuestion, 
        round: room.round,
        totalQuestions: room.totalQuestions,
        mode: room.mode
      })
      socket.emit('scores-update', room.scores)
    }
    
    console.log(`👤 ${pseudo} a rejoint la room ${roomId}`)
  })

  socket.on('start-game', async ({ roomId, options }) => {
    const room = rooms.get(roomId)
    if (room && room.creator === socket.id && room.players.length === 2 && !room.isGenerating) {
      const mode = options?.mode || 'classic'
      const theme = options?.theme || null
      const difficulty = options?.difficulty || 'medium'
      
      room.mode = mode
      room.theme = theme
      room.difficulty = difficulty
      
      // Mode IA ou Quiz : générer les questions
      if (mode === 'ai' || mode === 'quiz') {
        if (!isAIAvailable()) {
          socket.emit('error', { message: 'Mode IA non disponible (clé API manquante)' })
          return
        }
        
        room.isGenerating = true
        io.to(roomId).emit('generating-questions', { theme, mode, difficulty })
        
        try {
          if (mode === 'quiz') {
            console.log(`🧠 Génération de questions quiz - thème: ${theme}, difficulté: ${difficulty}`)
            const questions = await generateQuizQuestions(theme, 10, difficulty)
            
            if (questions.length === 0) {
              socket.emit('error', { message: 'Erreur lors de la génération des questions' })
              room.isGenerating = false
              return
            }
            
            room.questionsList = questions // [{question, answer}, ...]
            room.totalQuestions = questions.length
            console.log(`✅ ${questions.length} questions quiz générées`)
          } else {
            console.log(`🤖 Génération de questions pour le thème: ${theme}`)
            const questions = await generateQuestions(theme, 10)
            
            if (questions.length === 0) {
              socket.emit('error', { message: 'Erreur lors de la génération des questions' })
              room.isGenerating = false
              return
            }
            
            room.questionsList = questions
            room.totalQuestions = questions.length
            console.log(`✅ ${questions.length} questions générées`)
          }
        } catch (error) {
          console.error('❌ Erreur génération:', error)
          socket.emit('error', { message: 'Erreur lors de la génération des questions' })
          room.isGenerating = false
          return
        }
        
        room.isGenerating = false
      } else {
        // Mode classique : mélanger les questions prédéfinies
        room.questionsList = shuffleArray(allQuestions)
        room.totalQuestions = room.questionsList.length
      }
      
      room.questionIndex = 0
      room.gameStarted = true
      room.round = 1
      
      // Pour le quiz, la question est un objet {question, answer}
      if (mode === 'quiz') {
        room.currentQuestion = room.questionsList[0].question
        room.currentAnswer = room.questionsList[0].answer
      } else {
        room.currentQuestion = room.questionsList[0]
      }
      room.answers = {}
      
      io.to(roomId).emit('game-started', { 
        question: room.currentQuestion, 
        round: room.round,
        totalQuestions: room.totalQuestions,
        mode: room.mode
      })
      console.log(`🎮 Partie lancée (${mode}) dans la room ${roomId} - ${room.totalQuestions} questions`)
    }
  })

  socket.on('submit-answer', async ({ roomId, answer }) => {
    const room = rooms.get(roomId)
    if (room && room.gameStarted) {
      room.answers[socket.id] = answer
      
      // Notifier l'autre joueur qu'on a répondu
      const otherPlayers = room.players.filter(p => p.id !== socket.id)
      otherPlayers.forEach(p => {
        io.to(p.id).emit('opponent-answered')
      })
      
      // Vérifier si les 2 joueurs ont répondu
      if (Object.keys(room.answers).length === 2) {
        const [player1Id, player2Id] = Object.keys(room.answers)
        const answer1 = room.answers[player1Id]
        const answer2 = room.answers[player2Id]
        const player1Name = room.players.find(p => p.id === player1Id)?.pseudo || 'Joueur 1'
        const player2Name = room.players.find(p => p.id === player2Id)?.pseudo || 'Joueur 2'
        
        let aiComment = null
        
        // MODE QUIZ : chaque joueur est évalué individuellement
        if (room.mode === 'quiz') {
          let player1Correct = false
          let player2Correct = false
          
          // Vérifier les réponses avec l'IA
          try {
            const [result1, result2] = await Promise.all([
              checkQuizAnswer(answer1, room.currentAnswer, room.currentQuestion),
              checkQuizAnswer(answer2, room.currentAnswer, room.currentQuestion)
            ])
            player1Correct = result1.correct
            player2Correct = result2.correct
          } catch (error) {
            console.error('❌ Erreur vérification quiz:', error.message)
            // Fallback: comparaison simple
            const normalize = (s) => s.toLowerCase().trim()
            player1Correct = normalize(answer1) === normalize(room.currentAnswer)
            player2Correct = normalize(answer2) === normalize(room.currentAnswer)
          }
          
          // Attribuer les points
          if (player1Correct) room.scores[player1Id] = (room.scores[player1Id] || 0) + 1
          if (player2Correct) room.scores[player2Id] = (room.scores[player2Id] || 0) + 1
          
          // Générer un commentaire
          try {
            aiComment = await generateQuizComment(
              room.currentQuestion, room.currentAnswer,
              player1Name, answer1, player1Correct,
              player2Name, answer2, player2Correct
            )
          } catch (error) {
            if (player1Correct && player2Correct) {
              aiComment = `${player1Name} et ${player2Name}, vous êtes des génies ! 🧠`
            } else if (!player1Correct && !player2Correct) {
              aiComment = `Personne n'a trouvé... C'était "${room.currentAnswer}" ! 📚`
            } else {
              const winner = player1Correct ? player1Name : player2Name
              const loser = player1Correct ? player2Name : player1Name
              aiComment = `Bravo ${winner} ! ${loser}, on révise ce soir ? 😅`
            }
          }
          
          // Vérifier si c'était la dernière question
          const isLastQuestion = room.questionIndex >= room.questionsList.length - 1
          
          // Envoyer le résultat QUIZ
          io.to(roomId).emit('round-result', {
            player1: {
              id: player1Id,
              pseudo: player1Name,
              answer: answer1,
              correct: player1Correct
            },
            player2: {
              id: player2Id,
              pseudo: player2Name,
              answer: answer2,
              correct: player2Correct
            },
            correctAnswer: room.currentAnswer,
            scores: room.scores,
            isLastQuestion,
            aiComment,
            mode: room.mode
          })
        } else {
          // MODE CLASSIQUE ou IA : recherche de points communs
          let isMatch = false
          
          // Vérification selon le mode
          if (room.mode === 'ai' && isAIAvailable()) {
            // Mode IA : vérification intelligente
            try {
              const matchResult = await checkAnswerMatch(answer1, answer2, room.currentQuestion)
              isMatch = matchResult.match
            } catch (error) {
              // Fallback sur la comparaison simple
              isMatch = simpleAnswerMatch(answer1, answer2)
            }
            
            // Générer un commentaire fun
            try {
              console.log(`🤖 Génération commentaire pour ${player1Name} vs ${player2Name}...`)
              aiComment = await generateRoundComment(room.currentQuestion, player1Name, answer1, player2Name, answer2, isMatch)
              console.log(`💬 Commentaire généré: ${aiComment}`)
            } catch (error) {
              console.error('❌ Erreur génération commentaire:', error.message)
              aiComment = isMatch 
                ? `${player1Name} et ${player2Name}, vous êtes sur la même longueur d'onde ! 🧠` 
                : `${player1Name} et ${player2Name}, c'est pas encore ça ! 🎲`
            }
            
            // S'assurer qu'on a toujours un commentaire
            if (!aiComment || aiComment.trim() === '') {
              aiComment = isMatch 
                ? `Bravo ${player1Name} et ${player2Name}, vous vous comprenez ! ✨` 
                : `${player1Name} dit "${answer1}", ${player2Name} dit "${answer2}"... Pas facile hein ! 😄`
            }
          } else {
            // Mode classique : comparaison simple
            isMatch = simpleAnswerMatch(answer1, answer2)
          }
          
          if (isMatch) {
            room.scores[player1Id] = (room.scores[player1Id] || 0) + 1
            room.scores[player2Id] = (room.scores[player2Id] || 0) + 1
          }
          
          // Vérifier si c'était la dernière question
          const isLastQuestion = room.questionIndex >= room.questionsList.length - 1
          
          // Envoyer le résultat
          io.to(roomId).emit('round-result', {
            player1: {
              id: player1Id,
              pseudo: player1Name,
              answer: answer1
            },
            player2: {
              id: player2Id,
              pseudo: player2Name,
              answer: answer2
            },
            isMatch,
            scores: room.scores,
            isLastQuestion,
            aiComment,
            mode: room.mode
          })
        }
      }
    }
  })

  socket.on('next-round', ({ roomId }) => {
    const room = rooms.get(roomId)
    if (room) {
      if (!room.readyForNext) room.readyForNext = []
      if (!room.readyForNext.includes(socket.id)) {
        room.readyForNext.push(socket.id)
      }
      
      io.to(roomId).emit('ready-count', room.readyForNext.length)
      
      if (room.readyForNext.length === 2) {
        room.questionIndex++
        
        // Vérifier si on a encore des questions
        if (room.questionIndex >= room.questionsList.length) {
          // Fin de partie !
          io.to(roomId).emit('game-over', {
            scores: room.scores,
            players: room.players,
            mode: room.mode
          })
          room.gameStarted = false
        } else {
          // Question suivante
          room.round++
          
          // Pour le quiz, extraire question et answer
          if (room.mode === 'quiz') {
            room.currentQuestion = room.questionsList[room.questionIndex].question
            room.currentAnswer = room.questionsList[room.questionIndex].answer
          } else {
            room.currentQuestion = room.questionsList[room.questionIndex]
          }
          
          room.answers = {}
          room.readyForNext = []
          
          io.to(roomId).emit('new-round', { 
            question: room.currentQuestion, 
            round: room.round,
            totalQuestions: room.totalQuestions,
            mode: room.mode
          })
        }
      }
    }
  })

  // Chat
  socket.on('chat-message', ({ roomId, pseudo, message }) => {
    const room = rooms.get(roomId)
    if (room) {
      const chatMessage = {
        id: Date.now(),
        pseudo,
        message,
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      }
      
      room.messages.push(chatMessage)
      
      // Garder max 50 messages
      if (room.messages.length > 50) {
        room.messages.shift()
      }
      
      io.to(roomId).emit('chat-message', chatMessage)
    }
  })

  socket.on('leave-room', ({ roomId }) => {
    socket.leave(roomId)
    removePlayerFromRoom(socket.id, roomId)
  })

  socket.on('disconnect', () => {
    console.log('🔌 Joueur déconnecté:', socket.id)
    rooms.forEach((room, roomId) => {
      removePlayerFromRoom(socket.id, roomId)
    })
  })

  function removePlayerFromRoom(playerId, roomId) {
    const room = rooms.get(roomId)
    if (room) {
      room.players = room.players.filter(p => p.id !== playerId)
      delete room.scores[playerId]
      
      if (room.players.length === 0) {
        rooms.delete(roomId)
        console.log(`🗑️ Room ${roomId} supprimée`)
      } else {
        // Si le créateur part, le nouveau joueur devient créateur
        if (room.creator === playerId && room.players.length > 0) {
          room.creator = room.players[0].id
        }
        io.to(roomId).emit('players-update', room.players)
        io.to(roomId).emit('player-left')
      }
    }
  }
})

// Servir le frontend en production
if (existsSync(distPath)) {
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(join(distPath, 'index.html'))
    } else {
      next()
    }
  })
}

server.listen(PORT, () => {
  console.log(`🚀 GuessLink server running on port ${PORT}`)
  console.log(`📝 ${allQuestions.length} questions classiques chargées`)
  const provider = getCurrentProvider()
  console.log(`🤖 AI: ${isAIAvailable() ? `${provider} ✅` : 'Non disponible ❌'}`)
})
