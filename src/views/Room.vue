<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSocket } from '../composables/useSocket'

const route = useRoute()
const router = useRouter()
const { 
  players, 
  isConnected, 
  gameStarted, 
  isCreator, 
  joinRoom, 
  leaveRoom, 
  startGame 
} = useSocket()

const pseudo = ref('')
const roomId = computed(() => route.params.roomId)
const copiedCode = ref(false)
const copiedLink = ref(false)

// Mode de jeu
const selectedMode = ref('classic') // 'classic', 'ai' ou 'quiz'
const selectedTheme = ref('')
const customTheme = ref('')
const selectedDifficulty = ref('medium') // 'easy', 'medium', 'hard'

// Niveaux de difficulté pour le quiz
const difficulties = [
  { id: 'easy', label: '😊 Facile', description: 'Questions accessibles' },
  { id: 'medium', label: '🤔 Moyen', description: 'Culture générale standard' },
  { id: 'hard', label: '🔥 Difficile', description: 'Pour les experts !' },
]

// Thèmes pour le mode Points Communs IA
const themes = [
  { id: 'cinema', label: '🎬 Cinéma & Séries', value: 'films, séries TV, acteurs, réalisateurs' },
  { id: 'music', label: '🎵 Musique', value: 'musique, artistes, chansons, albums, concerts' },
  { id: 'gaming', label: '🎮 Jeux Vidéo', value: 'jeux vidéo, consoles, personnages de jeux' },
  { id: 'food', label: '🍕 Nourriture', value: 'nourriture, plats, restaurants, desserts, boissons' },
  { id: 'travel', label: '✈️ Voyage', value: 'voyages, pays, villes, destinations de rêve' },
  { id: 'sport', label: '⚽ Sport', value: 'sports, équipes, athlètes, compétitions' },
  { id: 'random', label: '🎲 Surprise !', value: 'sujets variés et surprenants' },
  { id: 'custom', label: '✏️ Personnalisé', value: '' },
]

// Thèmes pour le mode Quiz
const quizThemes = [
  { id: 'general', label: '🌍 Culture Générale', value: 'culture générale variée' },
  { id: 'history', label: '📜 Histoire', value: 'histoire, dates importantes, personnages historiques' },
  { id: 'geography', label: '🗺️ Géographie', value: 'géographie, capitales, pays, fleuves, montagnes' },
  { id: 'science', label: '🔬 Sciences', value: 'sciences, physique, chimie, biologie, astronomie' },
  { id: 'cinema', label: '🎬 Cinéma', value: 'cinéma, films, acteurs, réalisateurs, Oscars' },
  { id: 'music', label: '🎵 Musique', value: 'musique, artistes, albums, histoire de la musique' },
  { id: 'sport', label: '⚽ Sport', value: 'sport, records, champions, compétitions' },
  { id: 'custom', label: '✏️ Personnalisé', value: '' },
]

// L'autre joueur (pas nous)
const otherPlayer = computed(() => {
  return players.value.find(p => p.pseudo !== pseudo.value)
})

// Thème final à envoyer
const finalTheme = computed(() => {
  if (selectedTheme.value === 'custom') {
    return customTheme.value || 'sujets variés'
  }
  // Choisir la bonne liste de thèmes selon le mode
  const themeList = selectedMode.value === 'quiz' ? quizThemes : themes
  const theme = themeList.find(t => t.id === selectedTheme.value)
  return theme?.value || null
})

// Quand la partie commence, rediriger vers la page de jeu
watch(gameStarted, (started) => {
  if (started) {
    router.push(`/game/${roomId.value}`)
  }
})

onMounted(() => {
  pseudo.value = localStorage.getItem('pseudo') || ''
  if (!pseudo.value) {
    router.push('/')
    return
  }
  
  joinRoom(roomId.value, pseudo.value)
})

onUnmounted(() => {
  // Ne pas quitter la room si on va vers /game
  if (!route.path.includes('/game/')) {
    leaveRoom(roomId.value)
  }
})

const copyRoomCode = async () => {
  await navigator.clipboard.writeText(roomId.value)
  copiedCode.value = true
  setTimeout(() => copiedCode.value = false, 2000)
}

const copyRoomLink = async () => {
  const link = `${window.location.origin}/room/${roomId.value}`
  await navigator.clipboard.writeText(link)
  copiedLink.value = true
  setTimeout(() => copiedLink.value = false, 2000)
}

const handleStartGame = () => {
  const options = {
    mode: selectedMode.value,
    theme: (selectedMode.value === 'ai' || selectedMode.value === 'quiz') ? finalTheme.value : null,
    difficulty: selectedMode.value === 'quiz' ? selectedDifficulty.value : null
  }
  startGame(roomId.value, options)
}

const canStart = computed(() => {
  if (selectedMode.value === 'classic') return true
  if (selectedMode.value === 'ai' || selectedMode.value === 'quiz') {
    if (selectedTheme.value === 'custom') {
      return customTheme.value.trim().length >= 3
    }
    return selectedTheme.value !== ''
  }
  return false
})

// Reset du thème quand on change de mode
watch(selectedMode, () => {
  selectedTheme.value = ''
  customTheme.value = ''
})
</script>

<template>
  <div class="room">
    <div class="room-header">
      <h1>Room <span class="room-code">{{ roomId }}</span></h1>
      <div class="copy-buttons">
        <button class="copy-btn" @click="copyRoomCode">
          {{ copiedCode ? '✓ Copié !' : '📋 Code' }}
        </button>
        <button class="copy-btn copy-link" @click="copyRoomLink">
          {{ copiedLink ? '✓ Copié !' : '🔗 Lien' }}
        </button>
      </div>
      <div class="connection-status" :class="{ connected: isConnected }">
        {{ isConnected ? '🟢 Connecté' : '🔴 Connexion...' }}
      </div>
    </div>

    <div class="card">
      <div v-if="!otherPlayer" class="waiting">
        <div class="loader"></div>
        <p>En attente d'un autre joueur...</p>
        <p class="hint">Partage le code <strong>{{ roomId }}</strong> à ton ami !</p>
      </div>

      <div v-else class="ready">
        <span class="ready-icon">🎉</span>
        <p>Vous êtes prêts !</p>
      </div>

      <div class="players">
        <div class="player you">
          <span class="avatar">🎮</span>
          <span class="name">{{ pseudo }} (toi)</span>
        </div>
        <div class="vs">VS</div>
        <div class="player" :class="otherPlayer ? 'other' : 'waiting-player'">
          <span class="avatar">{{ otherPlayer ? '🎮' : '❓' }}</span>
          <span class="name">{{ otherPlayer ? otherPlayer.pseudo : 'En attente...' }}</span>
        </div>
      </div>

      <!-- Sélection du mode (seulement pour le créateur quand 2 joueurs) -->
      <div v-if="otherPlayer && isCreator" class="mode-selection">
        <p class="section-title">Choisis le mode de jeu</p>
        
        <div class="mode-buttons three-cols">
          <button 
            class="mode-btn"
            :class="{ active: selectedMode === 'classic' }"
            @click="selectedMode = 'classic'"
          >
            <span class="mode-icon">📝</span>
            <span class="mode-name">Classique</span>
            <span class="mode-desc">Points communs</span>
          </button>
          
          <button 
            class="mode-btn ai"
            :class="{ active: selectedMode === 'ai' }"
            @click="selectedMode = 'ai'"
          >
            <span class="mode-icon">🤖</span>
            <span class="mode-name">IA</span>
            <span class="mode-desc">Points communs IA</span>
          </button>

          <button 
            class="mode-btn quiz"
            :class="{ active: selectedMode === 'quiz' }"
            @click="selectedMode = 'quiz'"
          >
            <span class="mode-icon">🧠</span>
            <span class="mode-name">Quiz</span>
            <span class="mode-desc">Culture générale</span>
          </button>
        </div>

        <!-- Sélection du thème si mode IA -->
        <div v-if="selectedMode === 'ai'" class="theme-selection">
          <p class="section-title">Choisis un thème</p>
          
          <div class="theme-grid">
            <button 
              v-for="theme in themes"
              :key="theme.id"
              class="theme-btn"
              :class="{ active: selectedTheme === theme.id }"
              @click="selectedTheme = theme.id"
            >
              {{ theme.label }}
            </button>
          </div>

          <!-- Input personnalisé -->
          <div v-if="selectedTheme === 'custom'" class="custom-theme">
            <input 
              v-model="customTheme"
              type="text"
              placeholder="Ex: animés japonais, Marvel, années 90..."
              maxlength="50"
            />
          </div>
        </div>

        <!-- Sélection du thème si mode Quiz -->
        <div v-if="selectedMode === 'quiz'" class="theme-selection">
          <p class="section-title">Choisis une catégorie</p>
          
          <div class="theme-grid">
            <button 
              v-for="theme in quizThemes"
              :key="theme.id"
              class="theme-btn quiz-theme"
              :class="{ active: selectedTheme === theme.id }"
              @click="selectedTheme = theme.id"
            >
              {{ theme.label }}
            </button>
          </div>

          <!-- Input personnalisé -->
          <div v-if="selectedTheme === 'custom'" class="custom-theme">
            <input 
              v-model="customTheme"
              type="text"
              placeholder="Ex: Harry Potter, astronomie, jeux olympiques..."
              maxlength="50"
            />
          </div>

          <!-- Sélection de la difficulté -->
          <p class="section-title">Niveau de difficulté</p>
          <div class="difficulty-buttons">
            <button 
              v-for="diff in difficulties"
              :key="diff.id"
              class="difficulty-btn"
              :class="{ active: selectedDifficulty === diff.id, [diff.id]: true }"
              @click="selectedDifficulty = diff.id"
            >
              <span class="diff-label">{{ diff.label }}</span>
              <span class="diff-desc">{{ diff.description }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Message pour le non-créateur -->
      <div v-if="otherPlayer && !isCreator" class="waiting-config">
        <p>{{ otherPlayer?.pseudo }} configure la partie...</p>
      </div>

      <div class="actions">
        <button 
          v-if="otherPlayer && isCreator" 
          class="btn-start" 
          :class="{ ai: selectedMode === 'ai', quiz: selectedMode === 'quiz' }"
          :disabled="!canStart"
          @click="handleStartGame"
        >
          <template v-if="selectedMode === 'classic'">
            🎯 Lancer la partie
          </template>
          <template v-else-if="selectedMode === 'ai'">
            🤖 Générer les questions
          </template>
          <template v-else>
            🧠 Lancer le Quiz
          </template>
        </button>
        
        <p v-if="otherPlayer && !isCreator" class="waiting-start-msg">
          En attente du lancement...
        </p>

        <button class="btn-back" @click="router.push('/lobby')">
          ← Retour au lobby
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.room {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 550px;
}

.room-header {
  text-align: center;
  margin-bottom: 2rem;
}

h1 {
  font-size: 1.6rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: var(--text);
}

.room-code {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
  letter-spacing: 3px;
}

.copy-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.copy-btn {
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.3);
  color: var(--text);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.5);
}

.copy-link {
  background: rgba(108, 92, 231, 0.2);
  border: 1px solid rgba(108, 92, 231, 0.3);
}

.copy-link:hover {
  background: rgba(108, 92, 231, 0.3);
}

.connection-status {
  font-size: 0.8rem;
  color: var(--text-light);
}

.connection-status.connected {
  color: #059669;
}

.waiting, .ready {
  text-align: center;
  margin-bottom: 1.5rem;
}

.ready-icon {
  font-size: 3rem;
  display: block;
  animation: bounce 1s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.ready p {
  color: #059669;
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 0.5rem;
}

.loader {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(45, 52, 54, 0.1);
  border-top-color: var(--primary);
  border-radius: 50%;
  margin: 0 auto 1rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.waiting p {
  color: var(--text-light);
  margin: 0.5rem 0;
}

.hint {
  font-size: 0.9rem;
}

.hint strong {
  color: var(--primary);
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 2px;
}

.players {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.player {
  flex: 1;
  padding: 1rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.3);
  border: 2px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
}

.player.you {
  border-color: var(--primary);
  background: rgba(108, 92, 231, 0.15);
}

.player.other {
  border-color: var(--accent);
  background: rgba(253, 121, 168, 0.15);
}

.player.waiting-player {
  border-style: dashed;
  opacity: 0.6;
}

.vs {
  font-weight: 700;
  color: var(--text-light);
  font-size: 0.9rem;
}

.avatar {
  font-size: 1.75rem;
}

.name {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text);
}

/* Mode Selection */
.mode-selection {
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 0.9rem;
  color: var(--text-light);
  margin-bottom: 0.75rem;
  text-align: center;
}

.mode-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.mode-buttons.three-cols {
  grid-template-columns: repeat(3, 1fr);
}

.mode-btn {
  padding: 1rem;
  border: 2px solid var(--glass-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  font-family: inherit;
}

.mode-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.mode-btn.active {
  border-color: var(--primary);
  background: rgba(108, 92, 231, 0.2);
}

.mode-btn.ai.active {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.2);
}

.mode-btn.quiz.active {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.2);
}

.mode-icon {
  font-size: 1.5rem;
}

.mode-name {
  font-weight: 600;
  color: var(--text);
  font-size: 0.95rem;
}

.mode-desc {
  font-size: 0.7rem;
  color: var(--text-light);
}

/* Theme Selection */
.theme-selection {
  margin-top: 1.25rem;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.theme-btn {
  padding: 0.75rem 0.5rem;
  border: 2px solid var(--glass-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  font-size: 0.85rem;
  color: var(--text);
}

.theme-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.theme-btn.active {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.2);
  font-weight: 600;
}

.theme-btn.quiz-theme.active {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.2);
}

.custom-theme {
  margin-top: 0.75rem;
}

/* Difficulty Selection */
.difficulty-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.difficulty-btn {
  flex: 1;
  padding: 0.75rem 0.5rem;
  border: 2px solid var(--glass-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.difficulty-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.difficulty-btn.active.easy {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.2);
}

.difficulty-btn.active.medium {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.2);
}

.difficulty-btn.active.hard {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.2);
}

.diff-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
}

.diff-desc {
  font-size: 0.65rem;
  color: var(--text-light);
}

.custom-theme input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid var(--glass-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.3);
  color: var(--text);
  font-family: inherit;
  font-size: 0.9rem;
  outline: none;
  transition: all 0.3s ease;
}

.custom-theme input:focus {
  border-color: #10b981;
}

.custom-theme input::placeholder {
  color: var(--text-light);
}

.waiting-config {
  text-align: center;
  padding: 1rem;
  margin-bottom: 1rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
}

.waiting-config p {
  color: var(--text-light);
  margin: 0;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn-start {
  width: 100%;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  background: var(--dark);
  color: var(--white);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.btn-start:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(45, 52, 54, 0.4);
}

.btn-start.ai {
  background: linear-gradient(135deg, #10b981, #059669);
}

.btn-start.ai:hover:not(:disabled) {
  box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4);
}

.btn-start.quiz {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.btn-start.quiz:hover:not(:disabled) {
  box-shadow: 0 10px 30px rgba(245, 158, 11, 0.4);
}

.btn-start:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-back {
  padding: 0.8rem 1.5rem;
  font-size: 0.95rem;
  font-weight: 500;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.3);
  color: var(--text-light);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.btn-back:hover {
  background: rgba(255, 255, 255, 0.5);
  color: var(--text);
}

.waiting-start-msg {
  text-align: center;
  color: var(--text-light);
  font-size: 0.95rem;
  margin: 0;
  padding: 1rem;
}

@media (max-width: 600px) {
  .mode-buttons.three-cols {
    grid-template-columns: 1fr;
  }
  
  .mode-btn {
    flex-direction: row;
    justify-content: flex-start;
    gap: 0.75rem;
    text-align: left;
  }
  
  .mode-icon {
    font-size: 1.25rem;
  }
}

@media (max-width: 480px) {
  .theme-grid {
    grid-template-columns: 1fr;
  }
}
</style>
