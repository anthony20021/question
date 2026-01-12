import { ref } from 'vue'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

const socket = io(SOCKET_URL, {
  autoConnect: false
})

const isConnected = ref(false)
const players = ref([])
const isCreator = ref(false)
const gameStarted = ref(false)
const currentQuestion = ref('')
const currentRound = ref(0)
const scores = ref({})
const roundResult = ref(null)
const opponentAnswered = ref(false)
const readyCount = ref(0)

// Connexion
socket.on('connect', () => {
  isConnected.value = true
  console.log('🔌 Connecté au serveur')
})

socket.on('disconnect', () => {
  isConnected.value = false
  console.log('🔌 Déconnecté du serveur')
})

// Events room
socket.on('players-update', (updatedPlayers) => {
  players.value = updatedPlayers
})

socket.on('room-info', (info) => {
  isCreator.value = info.isCreator
  gameStarted.value = info.gameStarted
})

socket.on('player-left', () => {
  gameStarted.value = false
  roundResult.value = null
})

// Events jeu
socket.on('game-started', ({ question, round }) => {
  gameStarted.value = true
  currentQuestion.value = question
  currentRound.value = round
  roundResult.value = null
  opponentAnswered.value = false
})

socket.on('opponent-answered', () => {
  opponentAnswered.value = true
})

socket.on('round-result', (result) => {
  roundResult.value = result
  scores.value = result.scores
  opponentAnswered.value = false
})

socket.on('scores-update', (newScores) => {
  scores.value = newScores
})

socket.on('ready-count', (count) => {
  readyCount.value = count
})

socket.on('new-round', ({ question, round }) => {
  currentQuestion.value = question
  currentRound.value = round
  roundResult.value = null
  opponentAnswered.value = false
  readyCount.value = 0
})

export function useSocket() {
  const connect = () => {
    if (!socket.connected) {
      socket.connect()
    }
  }

  const disconnect = () => {
    socket.disconnect()
  }

  const joinRoom = (roomId, pseudo) => {
    connect()
    socket.emit('join-room', { roomId, pseudo })
  }

  const leaveRoom = (roomId) => {
    socket.emit('leave-room', { roomId })
    resetState()
  }

  const startGame = (roomId) => {
    socket.emit('start-game', { roomId })
  }

  const submitAnswer = (roomId, answer) => {
    socket.emit('submit-answer', { roomId, answer })
  }

  const nextRound = (roomId) => {
    socket.emit('next-round', { roomId })
  }

  const resetState = () => {
    players.value = []
    isCreator.value = false
    gameStarted.value = false
    currentQuestion.value = ''
    currentRound.value = 0
    scores.value = {}
    roundResult.value = null
    opponentAnswered.value = false
    readyCount.value = 0
  }

  return {
    // État
    isConnected,
    players,
    isCreator,
    gameStarted,
    currentQuestion,
    currentRound,
    scores,
    roundResult,
    opponentAnswered,
    readyCount,
    // Actions
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    startGame,
    submitAnswer,
    nextRound
  }
}

