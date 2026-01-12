import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

// Génère une question aléatoire (à enrichir plus tard)
const questions = [
  "Quel est ton film préféré ?",
  "Quelle est ta série préférée ?",
  "Quel est ton plat préféré ?",
  "Quelle est ta couleur préférée ?",
  "Quel est ton animal préféré ?",
  "Quelle est ta saison préférée ?",
  "Quel est ton sport préféré ?",
  "Quelle est ta musique préférée ?",
  "Quel est ton jeu vidéo préféré ?",
  "Quelle est ta destination de rêve ?"
]

function getRandomQuestion() {
  return questions[Math.floor(Math.random() * questions.length)]
}

io.on('connection', (socket) => {
  console.log('🔌 Nouveau joueur connecté:', socket.id)

  socket.on('join-room', ({ roomId, pseudo }) => {
    socket.join(roomId)
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { 
        players: [], 
        creator: socket.id,
        gameStarted: false,
        currentQuestion: null,
        answers: {},
        scores: {},
        round: 0
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
      gameStarted: room.gameStarted 
    })
    
    // Si la partie a déjà commencé, envoyer l'état actuel
    if (room.gameStarted && room.currentQuestion) {
      socket.emit('game-started', { question: room.currentQuestion, round: room.round })
      socket.emit('scores-update', room.scores)
    }
    
    console.log(`👤 ${pseudo} a rejoint la room ${roomId}`)
  })

  socket.on('start-game', ({ roomId }) => {
    const room = rooms.get(roomId)
    if (room && room.creator === socket.id && room.players.length === 2) {
      room.gameStarted = true
      room.round = 1
      room.currentQuestion = getRandomQuestion()
      room.answers = {}
      
      io.to(roomId).emit('game-started', { 
        question: room.currentQuestion, 
        round: room.round 
      })
      console.log(`🎮 Partie lancée dans la room ${roomId}`)
    }
  })

  socket.on('submit-answer', ({ roomId, answer }) => {
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
        const answer1 = room.answers[player1Id].toLowerCase().trim()
        const answer2 = room.answers[player2Id].toLowerCase().trim()
        
        // Vérifier si les réponses sont similaires (point commun trouvé)
        const isMatch = answer1 === answer2 || 
                        answer1.includes(answer2) || 
                        answer2.includes(answer1)
        
        if (isMatch) {
          room.scores[player1Id] = (room.scores[player1Id] || 0) + 1
          room.scores[player2Id] = (room.scores[player2Id] || 0) + 1
        }
        
        // Envoyer le résultat
        io.to(roomId).emit('round-result', {
          player1: {
            id: player1Id,
            pseudo: room.players.find(p => p.id === player1Id)?.pseudo,
            answer: room.answers[player1Id]
          },
          player2: {
            id: player2Id,
            pseudo: room.players.find(p => p.id === player2Id)?.pseudo,
            answer: room.answers[player2Id]
          },
          isMatch,
          scores: room.scores
        })
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
        room.round++
        room.currentQuestion = getRandomQuestion()
        room.answers = {}
        room.readyForNext = []
        
        io.to(roomId).emit('new-round', { 
          question: room.currentQuestion, 
          round: room.round 
        })
      }
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
})

