import { ref, shallowRef, triggerRef } from 'vue'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

const socket = io(SOCKET_URL, {
  autoConnect: false
})

const isConnected = ref(false)
const players = shallowRef([])
const messages = shallowRef([])
const isCreator = ref(false)
const gameStarted = ref(false)
const gameOver = ref(false)
const currentQuestion = ref('')
const currentRound = ref(0)
const totalQuestions = ref(0)
const scores = shallowRef({})
const roundResult = shallowRef(null)
const opponentAnswered = ref(false)
const readyCount = ref(0)
const isLastQuestion = ref(false)

// Mode IA
const gameMode = ref('classic')
const isGenerating = ref(false)
const generatingTheme = ref('')
const aiComment = ref('')
const aiExplanation = ref('')
const errorMessage = ref('')

// Connexion
socket.on('connect', () => {
  isConnected.value = true
  console.log('🔌 Connecté au serveur')
})

socket.on('disconnect', () => {
  isConnected.value = false
  players.value = []
  messages.value = []
  triggerRef(players)
  triggerRef(messages)
  console.log('🔌 Déconnecté du serveur')
})

// Events room
socket.on('players-update', (updatedPlayers) => {
  players.value = updatedPlayers
  triggerRef(players)
})

socket.on('room-info', (info) => {
  isCreator.value = info.isCreator
  gameStarted.value = info.gameStarted
  gameMode.value = info.mode || 'classic'
})

socket.on('player-left', () => {
  gameStarted.value = false
  roundResult.value = null
})

// Events chat
socket.on('chat-history', (history) => {
  messages.value = history
  triggerRef(messages)
})

socket.on('chat-message', (message) => {
  messages.value = [...messages.value, message]
  triggerRef(messages)
})

// Events IA
socket.on('generating-questions', ({ theme }) => {
  isGenerating.value = true
  generatingTheme.value = theme || 'variés'
})

socket.on('error', ({ message }) => {
  errorMessage.value = message
  isGenerating.value = false
  setTimeout(() => {
    errorMessage.value = ''
  }, 5000)
})

// Events jeu
socket.on('game-started', ({ question, round, totalQuestions: total, mode }) => {
  gameStarted.value = true
  gameOver.value = false
  isGenerating.value = false
  currentQuestion.value = question
  currentRound.value = round
  totalQuestions.value = total
  gameMode.value = mode || 'classic'
  roundResult.value = null
  opponentAnswered.value = false
  isLastQuestion.value = false
  aiComment.value = ''
  aiExplanation.value = ''
})

socket.on('opponent-answered', () => {
  opponentAnswered.value = true
})

socket.on('round-result', (result) => {
  roundResult.value = result
  scores.value = result.scores
  opponentAnswered.value = false
  isLastQuestion.value = result.isLastQuestion || false
  aiComment.value = result.aiComment || ''
  aiExplanation.value = result.aiExplanation || ''
  triggerRef(roundResult)
  triggerRef(scores)
})

socket.on('scores-update', (newScores) => {
  scores.value = newScores
  triggerRef(scores)
})

socket.on('ready-count', (count) => {
  readyCount.value = count
})

socket.on('new-round', ({ question, round, totalQuestions: total, mode }) => {
  currentQuestion.value = question
  currentRound.value = round
  totalQuestions.value = total
  gameMode.value = mode || 'classic'
  roundResult.value = null
  opponentAnswered.value = false
  readyCount.value = 0
  isLastQuestion.value = false
  aiComment.value = ''
  aiExplanation.value = ''
})

socket.on('game-over', ({ scores: finalScores, mode }) => {
  gameOver.value = true
  scores.value = finalScores
  gameMode.value = mode || 'classic'
  triggerRef(scores)
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

  const startGame = (roomId, options = {}) => {
    socket.emit('start-game', { roomId, options })
  }

  const submitAnswer = (roomId, answer) => {
    socket.emit('submit-answer', { roomId, answer })
  }

  const nextRound = (roomId) => {
    socket.emit('next-round', { roomId })
  }

  const sendMessage = (roomId, pseudo, message) => {
    if (message.trim()) {
      socket.emit('chat-message', { roomId, pseudo, message: message.trim() })
    }
  }

  const resetState = () => {
    players.value = []
    messages.value = []
    isCreator.value = false
    gameStarted.value = false
    gameOver.value = false
    currentQuestion.value = ''
    currentRound.value = 0
    totalQuestions.value = 0
    scores.value = {}
    roundResult.value = null
    opponentAnswered.value = false
    readyCount.value = 0
    isLastQuestion.value = false
    gameMode.value = 'classic'
    isGenerating.value = false
    generatingTheme.value = ''
    aiComment.value = ''
    aiExplanation.value = ''
    errorMessage.value = ''
    triggerRef(players)
    triggerRef(messages)
  }

  return {
    // État
    isConnected,
    players,
    messages,
    isCreator,
    gameStarted,
    gameOver,
    currentQuestion,
    currentRound,
    totalQuestions,
    scores,
    roundResult,
    opponentAnswered,
    readyCount,
    isLastQuestion,
    // État IA
    gameMode,
    isGenerating,
    generatingTheme,
    aiComment,
    aiExplanation,
    errorMessage,
    // Actions
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    startGame,
    submitAnswer,
    nextRound,
    sendMessage
  }
}
