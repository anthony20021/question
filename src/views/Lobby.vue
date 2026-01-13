<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const pseudo = ref('')
const roomCode = ref('')
const showJoin = ref(false)

onMounted(() => {
  pseudo.value = localStorage.getItem('pseudo') || ''
  if (!pseudo.value) {
    router.push('/')
  }
})

const createRoom = () => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  router.push(`/room/${code}`)
}

const joinRoom = () => {
  if (roomCode.value.trim()) {
    router.push(`/room/${roomCode.value.trim().toUpperCase()}`)
  }
}

const changePseudo = () => {
  localStorage.removeItem('pseudo')
  router.push('/')
}
</script>

<template>
  <div class="lobby">
    <div class="header">
      <span class="wave">👋</span>
      <h2>Salut <span class="pseudo-highlight">{{ pseudo }}</span> !</h2>
      <button class="btn-change" @click="changePseudo">Changer</button>
    </div>

    <div class="card">
      <div class="actions">
        <button class="btn-create" @click="createRoom">
          <span class="btn-icon">✨</span>
          Créer une room
        </button>

        <div class="divider">
          <span>ou</span>
        </div>

        <div v-if="!showJoin">
          <button class="btn-join" @click="showJoin = true">
            <span class="btn-icon">🔗</span>
            Rejoindre une room
          </button>
        </div>

        <div v-else class="join-form">
          <input 
            v-model="roomCode" 
            type="text" 
            placeholder="Code de la room..."
            @keyup.enter="joinRoom"
            maxlength="6"
          />
          <button @click="joinRoom" :disabled="!roomCode.trim()">
            Go !
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 450px;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.wave {
  font-size: 3rem;
  display: block;
  margin-bottom: 0.5rem;
  animation: wave 1.5s ease-in-out infinite;
}

@keyframes wave {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(20deg); }
  75% { transform: rotate(-10deg); }
}

h2 {
  font-size: 1.8rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--text);
}

.pseudo-highlight {
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
}

.btn-change {
  background: transparent;
  border: none;
  color: var(--text-light);
  font-size: 0.85rem;
  cursor: pointer;
  text-decoration: underline;
  font-family: inherit;
  padding: 0.25rem;
}

.btn-change:hover {
  color: var(--text);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.btn-create, .btn-join {
  width: 100%;
  padding: 1.2rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-create {
  background: var(--dark);
  color: var(--white);
}

.btn-create:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(45, 52, 54, 0.4);
}

.btn-join {
  background: rgba(255, 255, 255, 0.3);
  border: 2px solid var(--glass-border);
  color: var(--text);
}

.btn-join:hover {
  background: rgba(255, 255, 255, 0.5);
  border-color: var(--primary);
}

.btn-icon {
  font-size: 1.3rem;
}

.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: var(--text-light);
  margin: 0.5rem 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(45, 52, 54, 0.2);
}

.join-form {
  display: flex;
  gap: 0.75rem;
}

.join-form input {
  flex: 1;
  padding: 1rem 1.25rem;
  font-size: 1rem;
  border: 2px solid var(--glass-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.3);
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 2px;
  font-weight: 600;
  outline: none;
  transition: all 0.3s ease;
  font-family: inherit;
}

.join-form input::placeholder {
  color: var(--text-light);
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}

.join-form input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 20px rgba(108, 92, 231, 0.2);
}

.join-form button {
  padding: 1rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  background: var(--dark);
  color: var(--white);
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.join-form button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(45, 52, 54, 0.4);
}

.join-form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .join-form {
    flex-direction: column;
  }
  
  .join-form button {
    width: 100%;
  }
}
</style>
