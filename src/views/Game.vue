<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSocket } from '../composables/useSocket'

const route = useRoute()
const router = useRouter()
const { 
  players,
  messages,
  currentQuestion,
  currentRound,
  totalQuestions,
  scores,
  roundResult,
  opponentAnswered,
  readyCount,
  isLastQuestion,
  gameOver,
  gameMode,
  isGenerating,
  generatingTheme,
  isValidating,
  aiComment,
  aiExplanation,
  errorMessage,
  joinRoom,
  leaveRoom,
  submitAnswer,
  nextRound,
  sendMessage
} = useSocket()

const pseudo = ref('')
const roomId = computed(() => route.params.roomId)
const answer = ref('')
const hasSubmitted = ref(false)
const isReadyForNext = ref(false)
const newMessage = ref('')
const chatContainer = ref(null)
const chatOpen = ref(false)

const myScore = computed(() => {
  const me = players.value.find(p => p.pseudo === pseudo.value)
  return me ? scores.value[me.id] || 0 : 0
})

const opponentScore = computed(() => {
  const opponent = players.value.find(p => p.pseudo !== pseudo.value)
  return opponent ? scores.value[opponent.id] || 0 : 0
})

const opponent = computed(() => {
  return players.value.find(p => p.pseudo !== pseudo.value)
})

const isAIMode = computed(() => gameMode.value === 'ai')
const isQuizMode = computed(() => gameMode.value === 'quiz')

// Auto-scroll chat
watch(messages, async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}, { deep: true })

onMounted(() => {
  pseudo.value = localStorage.getItem('pseudo') || ''
  if (!pseudo.value) {
    router.push('/')
    return
  }
  
  joinRoom(roomId.value, pseudo.value)
})

onUnmounted(() => {
  leaveRoom(roomId.value)
})

const handleSubmit = () => {
  if (answer.value.trim() && !hasSubmitted.value) {
    submitAnswer(roomId.value, answer.value.trim())
    hasSubmitted.value = true
  }
}

const handleNextRound = () => {
  if (!isReadyForNext.value) {
    nextRound(roomId.value)
    isReadyForNext.value = true
  }
}

const handleSendMessage = () => {
  if (newMessage.value.trim()) {
    sendMessage(roomId.value, pseudo.value, newMessage.value)
    newMessage.value = ''
  }
}

const toggleChat = () => {
  chatOpen.value = !chatOpen.value
}

// Reset quand nouveau round
const resetRound = () => {
  answer.value = ''
  hasSubmitted.value = false
  isReadyForNext.value = false
}

watch(currentRound, () => {
  resetRound()
})
</script>

<template>
  <div class="game">
    <!-- Écran de génération (Mode IA) -->
    <div v-if="isGenerating" class="generating-screen">
      <div class="generating-card">
        <span class="ai-icon">🦙</span>
        <h2>L'IA prépare vos questions...</h2>
        <p class="theme-label">Thème : <span>{{ generatingTheme }}</span></p>
        <div class="ai-loader">
          <div class="ai-dot"></div>
          <div class="ai-dot"></div>
          <div class="ai-dot"></div>
        </div>
        <p class="generating-hint">Quelques secondes pour concocter des questions originales ✨</p>
      </div>
    </div>

    <!-- Message d'erreur -->
    <div v-if="errorMessage" class="error-toast">
      ⚠️ {{ errorMessage }}
    </div>

    <!-- Écran de fin de partie -->
    <div v-else-if="gameOver" class="game-over-screen">
      <div class="game-over-card">
        <span class="trophy">🏆</span>
        <h1>Partie terminée !</h1>
        <p class="subtitle">
          {{ totalQuestions }} questions jouées
          <span v-if="isQuizMode" class="mode-badge quiz">🧠 Quiz</span>
          <span v-else-if="isAIMode" class="mode-badge ai">🤖 Mode IA</span>
          <span v-else class="mode-badge classic">📝 Classique</span>
        </p>
        
        <div class="final-scores">
          <div class="final-player" :class="{ winner: myScore > opponentScore }">
            <span class="final-name">{{ pseudo }}</span>
            <span class="final-score">{{ myScore }}</span>
            <span class="final-label">points communs</span>
          </div>
          <div class="final-vs">VS</div>
          <div class="final-player" :class="{ winner: opponentScore > myScore }">
            <span class="final-name">{{ opponent?.pseudo }}</span>
            <span class="final-score">{{ opponentScore }}</span>
            <span class="final-label">points communs</span>
          </div>
        </div>

        <div class="result-message">
          <span v-if="myScore > opponentScore">🎉 Tu as gagné !</span>
          <span v-else-if="opponentScore > myScore">{{ opponent?.pseudo }} a gagné !</span>
          <span v-else>🤝 Égalité parfaite !</span>
        </div>

        <button class="btn-back-lobby" @click="router.push('/lobby')">
          Retour au lobby
        </button>
      </div>
    </div>

    <!-- Jeu en cours -->
    <div v-else class="game-container">
      <!-- Zone de jeu principale -->
      <div class="game-area">
        <!-- Header avec scores -->
        <div class="scoreboard">
          <div class="score-player you">
            <span class="score-name">{{ pseudo }}</span>
            <span class="score-value">{{ myScore }}</span>
          </div>
          <div class="round-info">
            <span class="round-indicator">{{ currentRound }} / {{ totalQuestions }}</span>
            <span v-if="isQuizMode" class="mode-indicator quiz">🧠 Quiz</span>
            <span v-else-if="isAIMode" class="mode-indicator ai">🤖 IA</span>
            <span v-else class="mode-indicator classic">📝</span>
          </div>
          <div class="score-player opponent">
            <span class="score-name">{{ opponent?.pseudo || '...' }}</span>
            <span class="score-value">{{ opponentScore }}</span>
          </div>
        </div>

        <div class="card">
          <!-- Question -->
          <div class="question-section">
            <span class="question-icon">{{ isQuizMode ? '🧠' : (isAIMode ? '🤖' : '❓') }}</span>
            <h2 class="question">{{ currentQuestion }}</h2>
          </div>

          <!-- Phase de réponse -->
          <div v-if="!roundResult" class="answer-section">
            <div v-if="!hasSubmitted" class="input-group">
              <input 
                v-model="answer"
                type="text"
                placeholder="Ta réponse..."
                @keyup.enter="handleSubmit"
                :disabled="hasSubmitted"
              />
              <button 
                class="btn-submit"
                @click="handleSubmit"
                :disabled="!answer.trim()"
              >
                Valider ✓
              </button>
            </div>

            <div v-else class="waiting-opponent">
              <div v-if="isValidating" class="validating-answers">
                <div class="ai-loader">
                  <span class="ai-brain">🧠</span>
                  <div class="ai-dots">
                    <span></span><span></span><span></span>
                  </div>
                </div>
                <p>L'IA vérifie vos réponses...</p>
              </div>
              <div v-else-if="opponentAnswered" class="opponent-ready">
                <span>✅</span> {{ opponent?.pseudo }} a répondu !
              </div>
              <div v-else class="opponent-waiting">
                <div class="mini-loader"></div>
                En attente de {{ opponent?.pseudo }}...
              </div>
            </div>
          </div>

          <!-- Résultat du round -->
          <div v-else class="result-section">
            <!-- Mode Quiz -->
            <template v-if="isQuizMode">
              <div class="quiz-results">
                <div class="quiz-answer-card" :class="{ correct: roundResult.player1.correct, wrong: !roundResult.player1.correct }">
                  <span class="quiz-status">{{ roundResult.player1.correct ? '✅' : '❌' }}</span>
                  <span class="quiz-player">{{ roundResult.player1.pseudo }}</span>
                  <span class="quiz-answer">{{ roundResult.player1.answer }}</span>
                </div>
                <div class="quiz-answer-card" :class="{ correct: roundResult.player2.correct, wrong: !roundResult.player2.correct }">
                  <span class="quiz-status">{{ roundResult.player2.correct ? '✅' : '❌' }}</span>
                  <span class="quiz-player">{{ roundResult.player2.pseudo }}</span>
                  <span class="quiz-answer">{{ roundResult.player2.answer }}</span>
                </div>
              </div>
              
              <div class="correct-answer-box">
                <span class="correct-label">Bonne réponse</span>
                <span class="correct-value">{{ roundResult.correctAnswer }}</span>
              </div>
            </template>

            <!-- Mode Points Communs -->
            <template v-else>
              <div class="result-header" :class="{ match: roundResult.isMatch }">
                <span class="result-icon">{{ roundResult.isMatch ? '🎉' : '😅' }}</span>
                <h3>{{ roundResult.isMatch ? 'Point commun trouvé !' : 'Pas de match...' }}</h3>
              </div>

              <div class="answers-compare">
                <div class="answer-card">
                  <span class="answer-player">{{ roundResult.player1.pseudo }}</span>
                  <span class="answer-text">{{ roundResult.player1.answer }}</span>
                </div>
                <div class="vs">VS</div>
                <div class="answer-card">
                  <span class="answer-player">{{ roundResult.player2.pseudo }}</span>
                  <span class="answer-text">{{ roundResult.player2.answer }}</span>
                </div>
              </div>
            </template>

            <!-- Commentaire IA -->
            <div v-if="aiComment" class="ai-comment">
              <span class="ai-comment-icon">{{ isQuizMode ? '🧠' : '🤖' }}</span>
              <p>{{ aiComment }}</p>
            </div>

            <div class="next-section">
              <button 
                class="btn-next"
                @click="handleNextRound"
                :disabled="isReadyForNext"
              >
                <template v-if="isReadyForNext">
                  En attente ({{ readyCount }}/2)
                </template>
                <template v-else-if="isLastQuestion">
                  Voir les résultats 🏆
                </template>
                <template v-else>
                  Question suivante →
                </template>
              </button>
            </div>
          </div>
        </div>

        <button class="btn-leave" @click="router.push('/lobby')">
          🚪 Quitter la partie
        </button>
      </div>

      <!-- Panel de chat (desktop) -->
      <div class="chat-panel desktop-chat">
        <div class="chat-header">
          <span>💬</span> Chat
        </div>
        <div class="chat-messages" ref="chatContainer">
          <div v-if="messages.length === 0" class="no-messages">
            Dis bonjour ! 👋
          </div>
          <div 
            v-for="msg in messages" 
            :key="msg.id" 
            class="message"
            :class="{ own: msg.pseudo === pseudo }"
          >
            <span class="message-author">{{ msg.pseudo }}</span>
            <span class="message-content">{{ msg.message }}</span>
          </div>
        </div>
        <div class="chat-input">
          <input 
            v-model="newMessage" 
            type="text" 
            placeholder="Message..."
            @keyup.enter="handleSendMessage"
            maxlength="200"
          />
          <button @click="handleSendMessage" :disabled="!newMessage.trim()">
            ➤
          </button>
        </div>
      </div>

      <!-- Bouton chat mobile -->
      <button class="chat-toggle" @click="toggleChat" :class="{ active: chatOpen }">
        💬
        <span v-if="messages.length > 0" class="chat-badge">{{ messages.length }}</span>
      </button>

      <!-- Chat mobile (slide) -->
      <div class="mobile-chat" :class="{ open: chatOpen }">
        <div class="mobile-chat-header">
          <span>💬 Chat</span>
          <button class="close-chat" @click="chatOpen = false">✕</button>
        </div>
        <div class="chat-messages" ref="chatContainer">
          <div v-if="messages.length === 0" class="no-messages">
            Dis bonjour ! 👋
          </div>
          <div 
            v-for="msg in messages" 
            :key="msg.id" 
            class="message"
            :class="{ own: msg.pseudo === pseudo }"
          >
            <span class="message-author">{{ msg.pseudo }}</span>
            <span class="message-content">{{ msg.message }}</span>
          </div>
        </div>
        <div class="chat-input">
          <input 
            v-model="newMessage" 
            type="text" 
            placeholder="Message..."
            @keyup.enter="handleSendMessage"
            maxlength="200"
          />
          <button @click="handleSendMessage" :disabled="!newMessage.trim()">
            ➤
          </button>
        </div>
      </div>

      <!-- Overlay -->
      <div class="chat-overlay" v-if="chatOpen" @click="chatOpen = false"></div>
    </div>
  </div>
</template>

<style scoped>
/* Generating Screen */
.generating-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  padding: 1rem;
}

.generating-card {
  background: var(--glass);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 3rem;
  border: 2px solid rgba(16, 185, 129, 0.3);
  text-align: center;
  max-width: 450px;
  width: 100%;
  animation: floatIn 0.5s ease-out;
}

@keyframes floatIn {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.ai-icon {
  font-size: 5rem;
  display: block;
  margin-bottom: 1rem;
  animation: robotBounce 1.5s ease-in-out infinite;
}

@keyframes robotBounce {
  0%, 100% { transform: translateY(0) rotate(-5deg); }
  50% { transform: translateY(-15px) rotate(5deg); }
}

.generating-card h2 {
  font-size: 1.5rem;
  color: var(--text);
  margin-bottom: 0.5rem;
}

.theme-label {
  color: var(--text-light);
  font-size: 1rem;
  margin-bottom: 2rem;
}

.theme-label span {
  color: #10b981;
  font-weight: 600;
}

.ai-loader {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.ai-dot {
  width: 12px;
  height: 12px;
  background: #10b981;
  border-radius: 50%;
  animation: dotPulse 1.4s ease-in-out infinite;
}

.ai-dot:nth-child(2) { animation-delay: 0.2s; }
.ai-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes dotPulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.generating-hint {
  font-size: 0.9rem;
  color: var(--text-light);
}

/* Error Toast */
.error-toast {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 1rem 2rem;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  border-radius: 12px;
  font-weight: 500;
  z-index: 1000;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
  to { transform: translateX(-50%) translateY(0); opacity: 1; }
}

/* Mode badges */
.mode-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-left: 0.5rem;
}

.mode-badge.ai {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.mode-badge.quiz {
  background: rgba(245, 158, 11, 0.2);
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.mode-badge.classic {
  background: rgba(108, 92, 231, 0.2);
  color: var(--primary);
  border: 1px solid rgba(108, 92, 231, 0.3);
}

/* Round info */
.round-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.round-indicator {
  font-size: 0.9rem;
  color: var(--text-light);
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  font-weight: 500;
}

.mode-indicator {
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  border-radius: 10px;
}

.mode-indicator.ai {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.mode-indicator.quiz {
  background: rgba(245, 158, 11, 0.2);
  color: #d97706;
}

.mode-indicator.classic {
  background: rgba(108, 92, 231, 0.2);
  color: var(--primary);
}

/* AI Comment */
.ai-comment {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05));
  border: 2px solid rgba(16, 185, 129, 0.3);
  border-radius: 16px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  text-align: center;
  animation: fadeSlideUp 0.4s ease-out;
}

@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.ai-comment-icon {
  font-size: 1.5rem;
  display: block;
  margin-bottom: 0.5rem;
}

.ai-comment p {
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--text);
  margin: 0;
  line-height: 1.4;
}


/* Game Over Screen */
.game-over-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  padding: 1rem;
}

.game-over-card {
  background: var(--glass);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 3rem;
  border: 2px solid var(--glass-border);
  text-align: center;
  max-width: 500px;
  width: 100%;
  animation: scaleIn 0.5s ease-out;
}

@keyframes scaleIn {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.trophy {
  font-size: 5rem;
  display: block;
  margin-bottom: 1rem;
  animation: bounce 1s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}

.game-over-card h1 {
  font-size: 2rem;
  color: var(--text);
  margin-bottom: 0.5rem;
}

.game-over-card .subtitle {
  color: var(--text-light);
  font-size: 1rem;
  margin-bottom: 2rem;
}

.final-scores {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.final-player {
  flex: 1;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.final-player.winner {
  background: rgba(108, 92, 231, 0.2);
  border-color: var(--primary);
}

.final-name {
  display: block;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.5rem;
}

.final-score {
  display: block;
  font-size: 3rem;
  font-weight: 800;
  color: var(--primary);
  line-height: 1;
}

.final-player.winner .final-score {
  color: var(--primary);
}

.final-label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-light);
  margin-top: 0.25rem;
}

.final-vs {
  font-weight: 700;
  color: var(--text-light);
}

.result-message {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 2rem;
}

.btn-back-lobby {
  padding: 1rem 2.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  background: var(--dark);
  color: var(--white);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.btn-back-lobby:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(45, 52, 54, 0.4);
}

/* Main Game */
.game {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100vh;
  padding: 0.75rem;
}

.game-container {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1rem;
  width: 100%;
  height: 100%;
  max-height: 100%;
}

.game-area {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow-y: auto;
}

.scoreboard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: var(--glass);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 2px solid var(--glass-border);
}

.score-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.score-player.you .score-name {
  color: var(--primary);
  font-weight: 600;
}

.score-player.opponent .score-name {
  color: var(--accent);
  font-weight: 600;
}

.score-name {
  font-size: 0.85rem;
  font-weight: 500;
}

.score-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text);
}

.card {
  flex: 1;
  background: var(--glass);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 2.5rem;
  border: 2px solid var(--glass-border);
}

.question-section {
  text-align: center;
  margin-bottom: 2rem;
}

.question-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.question {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text);
  margin-bottom: 0;
}

.answer-section {
  margin-top: 2rem;
}

.input-group {
  display: flex;
  gap: 0.75rem;
}

.input-group input {
  flex: 1;
  padding: 1.25rem 1.5rem;
  font-size: 1.1rem;
  border: 2px solid var(--glass-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.3);
  color: var(--text);
  outline: none;
  transition: all 0.3s ease;
  font-family: inherit;
}

.input-group input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 20px rgba(108, 92, 231, 0.2);
}

.input-group input::placeholder {
  color: var(--text-light);
}

.btn-submit {
  padding: 1.25rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  background: var(--dark);
  color: var(--white);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.btn-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(45, 52, 54, 0.3);
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.waiting-opponent {
  text-align: center;
  padding: 2rem;
}

.opponent-ready {
  color: #059669;
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.opponent-waiting {
  color: var(--text-light);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.mini-loader {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(45, 52, 54, 0.2);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Validation IA */
.validating-answers {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  animation: fadeIn 0.3s ease;
}

.validating-answers p {
  color: var(--text);
  font-weight: 600;
  font-size: 1.1rem;
}

.ai-loader {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ai-brain {
  font-size: 2.5rem;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

.ai-dots {
  display: flex;
  gap: 0.3rem;
}

.ai-dots span {
  width: 10px;
  height: 10px;
  background: var(--primary);
  border-radius: 50%;
  animation: bounce 1.4s ease-in-out infinite;
}

.ai-dots span:nth-child(1) { animation-delay: 0s; }
.ai-dots span:nth-child(2) { animation-delay: 0.2s; }
.ai-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.result-section {
  text-align: center;
}

.result-header {
  margin-bottom: 2rem;
}

.result-header.match {
  animation: celebrate 0.5s ease-out;
}

@keyframes celebrate {
  0% { transform: scale(0.8); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.result-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 0.5rem;
}

.result-header h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text);
}

.result-header.match h3 {
  color: #059669;
}

.answers-compare {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.answer-card {
  flex: 1;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Quiz Results */
.quiz-results {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.quiz-answer-card {
  flex: 1;
  padding: 1.25rem;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.quiz-answer-card.correct {
  background: rgba(16, 185, 129, 0.15);
  border-color: #10b981;
}

.quiz-answer-card.wrong {
  background: rgba(239, 68, 68, 0.15);
  border-color: #ef4444;
}

.quiz-status {
  font-size: 2rem;
}

.quiz-player {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

.quiz-answer {
  font-size: 1.1rem;
  color: var(--text-light);
}

.correct-answer-box {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1));
  border: 2px solid rgba(245, 158, 11, 0.4);
  border-radius: 12px;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  text-align: center;
}

.correct-label {
  display: block;
  font-size: 0.8rem;
  color: #d97706;
  font-weight: 600;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.correct-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  color: #b45309;
}

.answer-player {
  font-size: 0.85rem;
  color: var(--text-light);
}

.answer-text {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--primary);
}

.vs {
  font-weight: 700;
  color: var(--text-light);
}

.btn-next {
  width: 100%;
  padding: 1.25rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  background: var(--dark);
  color: var(--white);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.btn-next:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(45, 52, 54, 0.3);
}

.btn-next:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-leave {
  align-self: flex-start;
  padding: 0.75rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.3);
  color: var(--text-light);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.btn-leave:hover {
  background: rgba(255, 255, 255, 0.5);
  color: var(--text);
}

/* Chat Panel Desktop */
.chat-panel {
  display: flex;
  flex-direction: column;
  background: var(--glass);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 2px solid var(--glass-border);
  overflow: hidden;
  height: 100%;
}

.desktop-chat {
  display: flex;
}

.chat-header {
  padding: 1rem 1.25rem;
  background: rgba(45, 52, 54, 0.1);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  color: var(--text);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.no-messages {
  color: var(--text-light);
  font-size: 0.9rem;
  text-align: center;
  margin: auto;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.6rem 0.8rem;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.message.own {
  background: rgba(108, 92, 231, 0.2);
  border: 1px solid rgba(108, 92, 231, 0.3);
}

.message-author {
  font-weight: 600;
  color: var(--accent);
  font-size: 0.75rem;
}

.message.own .message-author {
  color: var(--primary);
}

.message-content {
  font-size: 0.9rem;
  word-break: break-word;
  color: var(--text);
}

.chat-input {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(45, 52, 54, 0.1);
}

.chat-input input {
  flex: 1;
  padding: 0.6rem 0.9rem;
  font-size: 0.9rem;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.3);
  color: var(--text);
  outline: none;
  font-family: inherit;
}

.chat-input input::placeholder {
  color: var(--text-light);
}

.chat-input input:focus {
  border-color: var(--primary);
}

.chat-input button {
  padding: 0.6rem 0.9rem;
  border: none;
  border-radius: 8px;
  background: var(--dark);
  color: var(--white);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 600;
}

.chat-input button:hover:not(:disabled) {
  transform: scale(1.05);
}

.chat-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Mobile chat toggle button */
.chat-toggle {
  display: none;
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--dark);
  color: white;
  font-size: 1.5rem;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(45, 52, 54, 0.4);
  z-index: 100;
  padding: 0;
  transition: all 0.3s ease;
}

.chat-toggle.active {
  background: var(--primary);
}

.chat-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: var(--accent);
  color: white;
  font-size: 0.7rem;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

/* Mobile chat panel */
.mobile-chat {
  display: none;
  position: fixed;
  top: 0;
  right: -100%;
  width: 85%;
  max-width: 350px;
  height: 100vh;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  flex-direction: column;
  z-index: 200;
  transition: right 0.3s ease;
}

.mobile-chat.open {
  right: 0;
}

.mobile-chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: var(--dark);
  color: white;
  font-weight: 600;
}

.close-chat {
  background: transparent;
  border: none;
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
}

.chat-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 150;
}

/* Scrollbar */
.chat-messages::-webkit-scrollbar,
.game-area::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track,
.game-area::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb,
.game-area::-webkit-scrollbar-thumb {
  background: rgba(45, 52, 54, 0.2);
  border-radius: 3px;
}

/* Responsive */
@media (max-width: 900px) {
  .game {
    padding: 0.5rem;
  }

  
  
  .game-container {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  
  .game-area {
    gap: 0.75rem;
  }
  
  .card {
    padding: 1.5rem;
  }
  
  .desktop-chat {
    display: none;
  }
  
  .chat-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .mobile-chat {
    display: flex;
  }
  
  .chat-overlay {
    display: block;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }
  
  .chat-overlay {
    opacity: 1;
    pointer-events: auto;
  }
  
  .input-group {
    flex-direction: column;
  }
  
  .answers-compare {
    flex-direction: column;
  }
  
  .quiz-results {
    flex-direction: column;
  }
  
  .vs {
    transform: rotate(90deg);
  }

  .ai-comment {
    padding: 1rem;
  }

  .ai-comment p {
    font-size: 1rem;
  }
}
</style>
