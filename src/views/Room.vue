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

// L'autre joueur (pas nous)
const otherPlayer = computed(() => {
  return players.value.find(p => p.pseudo !== pseudo.value)
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
  startGame(roomId.value)
}
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

      <div class="actions">
        <button 
          v-if="otherPlayer && isCreator" 
          class="btn-start" 
          @click="handleStartGame"
        >
          🎯 Lancer la partie
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
  max-width: 500px;
}

.room-header {
  text-align: center;
  margin-bottom: 2rem;
}

h1 {
  font-size: 1.6rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
}

.room-code {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  background: var(--gradient-2);
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
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.copy-link {
  background: rgba(0, 206, 201, 0.15);
  border: 1px solid rgba(0, 206, 201, 0.3);
}

.copy-link:hover {
  background: rgba(0, 206, 201, 0.25);
}

.connection-status {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

.connection-status.connected {
  color: #4ade80;
}

.card {
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 2.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.waiting, .ready {
  text-align: center;
  margin-bottom: 2rem;
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
  color: #4ade80;
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 0.5rem;
}

.loader {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--secondary);
  border-radius: 50%;
  margin: 0 auto 1rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.waiting p {
  color: rgba(255, 255, 255, 0.7);
  margin: 0.5rem 0;
}

.hint {
  font-size: 0.9rem;
}

.hint strong {
  color: var(--secondary);
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 2px;
}

.players {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.player {
  flex: 1;
  padding: 1.2rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
}

.player.you {
  border-color: var(--accent);
  background: rgba(253, 121, 168, 0.1);
}

.player.other {
  border-color: var(--secondary);
  background: rgba(0, 206, 201, 0.1);
}

.player.waiting-player {
  border-style: dashed;
  opacity: 0.6;
}

.vs {
  font-weight: 700;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.9rem;
}

.avatar {
  font-size: 2rem;
}

.name {
  font-size: 0.9rem;
  font-weight: 500;
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
  background: var(--gradient-2);
  color: var(--dark);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.btn-start:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 206, 201, 0.4);
}

.btn-back {
  padding: 0.8rem 1.5rem;
  font-size: 0.95rem;
  font-weight: 500;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.btn-back:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.waiting-start-msg {
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.95rem;
  margin: 0;
  padding: 1rem;
}
</style>

