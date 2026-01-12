<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSocket } from '../composables/useSocket'

const route = useRoute()
const router = useRouter()
const { 
  players,
  currentQuestion,
  currentRound,
  scores,
  roundResult,
  opponentAnswered,
  readyCount,
  joinRoom,
  leaveRoom,
  submitAnswer,
  nextRound
} = useSocket()

const pseudo = ref('')
const roomId = computed(() => route.params.roomId)
const answer = ref('')
const hasSubmitted = ref(false)
const isReadyForNext = ref(false)

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

onMounted(() => {
  pseudo.value = localStorage.getItem('pseudo') || ''
  if (!pseudo.value) {
    router.push('/')
    return
  }
  
  // Rejoindre la room si pas déjà connecté
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

// Reset quand nouveau round
const resetRound = () => {
  answer.value = ''
  hasSubmitted.value = false
  isReadyForNext.value = false
}

// Watcher pour nouveau round
import { watch } from 'vue'
watch(currentRound, () => {
  resetRound()
})
</script>

<template>
  <div class="game">
    <!-- Header avec scores -->
    <div class="scoreboard">
      <div class="score-player you">
        <span class="score-name">{{ pseudo }}</span>
        <span class="score-value">{{ myScore }}</span>
      </div>
      <div class="round-indicator">
        Round {{ currentRound }}
      </div>
      <div class="score-player opponent">
        <span class="score-name">{{ opponent?.pseudo || '...' }}</span>
        <span class="score-value">{{ opponentScore }}</span>
      </div>
    </div>

    <div class="card">
      <!-- Question -->
      <div class="question-section">
        <span class="question-icon">❓</span>
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
          <div v-if="opponentAnswered" class="opponent-ready">
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

        <div class="next-section">
          <button 
            class="btn-next"
            @click="handleNextRound"
            :disabled="isReadyForNext"
          >
            {{ isReadyForNext ? `En attente (${readyCount}/2)` : 'Question suivante →' }}
          </button>
        </div>
      </div>
    </div>

    <button class="btn-leave" @click="router.push('/lobby')">
      🚪 Quitter la partie
    </button>
  </div>
</template>

<style scoped>
.game {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 600px;
  gap: 1.5rem;
}

.scoreboard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.score-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.score-player.you .score-name {
  color: var(--accent);
}

.score-player.opponent .score-name {
  color: var(--secondary);
}

.score-name {
  font-size: 0.85rem;
  font-weight: 500;
}

.score-value {
  font-size: 2rem;
  font-weight: 700;
}

.round-indicator {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.6);
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
}

.card {
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 2.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
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
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  outline: none;
  transition: all 0.3s ease;
  font-family: inherit;
}

.input-group input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 20px rgba(108, 92, 231, 0.3);
}

.input-group input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.btn-submit {
  padding: 1.25rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  background: var(--gradient-1);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.btn-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(108, 92, 231, 0.4);
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
  color: #4ade80;
  font-size: 1.1rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.opponent-waiting {
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.mini-loader {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--secondary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
}

.result-header.match h3 {
  color: #4ade80;
}

.answers-compare {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.answer-card {
  flex: 1;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.answer-player {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
}

.answer-text {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--warning);
}

.vs {
  font-weight: 700;
  color: rgba(255, 255, 255, 0.3);
}

.btn-next {
  width: 100%;
  padding: 1.25rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  background: var(--gradient-2);
  color: var(--dark);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.btn-next:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 206, 201, 0.4);
}

.btn-next:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-leave {
  padding: 0.75rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.btn-leave:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

@media (max-width: 480px) {
  .input-group {
    flex-direction: column;
  }
  
  .answers-compare {
    flex-direction: column;
  }
  
  .vs {
    transform: rotate(90deg);
  }
}
</style>

