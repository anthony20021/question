import { ref, shallowRef, triggerRef, computed } from 'vue'
import { io } from 'socket.io-client'

// En dev (vite), le front (5173) et le backend (3001) sont sur des ports différents.
// En build/prod, tout est servi par le même serveur : on utilise alors l'origine de la page
// (ce qui fonctionne aussi bien en local qu'à distance via un tunnel).
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
  || (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin)

const socket = io(SOCKET_URL, {
  autoConnect: false
})

const isConnected = ref(false)
const mySocketId = ref(null)
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
const isValidating = ref(false)

// Écran de génération : messages qui tournent + timer (la génération peut prendre 15-30s)
const generatingMessages = [
  "L'IA fouille sa mémoire pour trouver un angle original...",
  "Elle évite les questions trop vues, ça prend un peu de temps...",
  "Recherche du bon équilibre entre drôle et malin...",
  "Elle élimine les idées trop banales une par une...",
  "Encore un peu de patience, elle peaufine les formulations...",
  "Elle vérifie que les questions ne se ressemblent pas trop...",
]
const generatingSeconds = ref(0)
const currentGeneratingMessage = computed(() => {
  return generatingMessages[Math.floor(generatingSeconds.value / 3) % generatingMessages.length]
})
let generatingInterval = null
function startGeneratingTimer() {
  generatingSeconds.value = 0
  if (generatingInterval) clearInterval(generatingInterval)
  generatingInterval = setInterval(() => { generatingSeconds.value++ }, 1000)
}
function stopGeneratingTimer() {
  if (generatingInterval) {
    clearInterval(generatingInterval)
    generatingInterval = null
  }
}

const aiComment = ref('')
const aiExplanation = ref('')
const matchStreak = ref(0)
const gameSummary = ref('')
const errorMessage = ref('')

// Options de la dernière partie (pour rejouer)
const lastGameOptions = ref(null)

// Connexion
socket.on('connect', () => {
  isConnected.value = true
  mySocketId.value = socket.id
  console.log('🔌 Connecté au serveur')
})

socket.on('disconnect', () => {
  isConnected.value = false
  mySocketId.value = null
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
  startGeneratingTimer()
})

socket.on('error', ({ message }) => {
  errorMessage.value = message
  isGenerating.value = false
  stopGeneratingTimer()
  setTimeout(() => {
    errorMessage.value = ''
  }, 5000)
})

// Events jeu
socket.on('game-started', ({ question, round, totalQuestions: total, mode }) => {
  gameStarted.value = true
  gameOver.value = false
  isGenerating.value = false
  stopGeneratingTimer()
  currentQuestion.value = question
  currentRound.value = round
  totalQuestions.value = total
  gameMode.value = mode || 'classic'
  roundResult.value = null
  opponentAnswered.value = false
  isLastQuestion.value = false
  aiComment.value = ''
  aiExplanation.value = ''
  matchStreak.value = 0
})

socket.on('opponent-answered', () => {
  opponentAnswered.value = true
})

socket.on('validating-answers', () => {
  isValidating.value = true
})

socket.on('round-result', (result) => {
  roundResult.value = result
  scores.value = result.scores
  opponentAnswered.value = false
  isValidating.value = false
  isLastQuestion.value = result.isLastQuestion || false
  aiComment.value = result.aiComment || ''
  aiExplanation.value = result.aiExplanation || ''
  matchStreak.value = result.matchStreak || 0
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

socket.on('game-over', ({ scores: finalScores, mode, gameSummary: summary }) => {
  gameOver.value = true
  scores.value = finalScores
  gameMode.value = mode || 'classic'
  gameSummary.value = summary || ''
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
    // Sauvegarder les options pour pouvoir rejouer
    lastGameOptions.value = options
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
    stopGeneratingTimer()
    isValidating.value = false
    aiComment.value = ''
    aiExplanation.value = ''
    matchStreak.value = 0
    gameSummary.value = ''
    errorMessage.value = ''
    triggerRef(players)
    triggerRef(messages)
  }

  return {
    // État
    isConnected,
    mySocketId,
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
    generatingSeconds,
    currentGeneratingMessage,
    isValidating,
    aiComment,
    aiExplanation,
    matchStreak,
    gameSummary,
    errorMessage,
    // Options dernière partie
    lastGameOptions,
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
