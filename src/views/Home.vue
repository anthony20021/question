<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const pseudo = ref('')
const isReady = computed(() => pseudo.value.trim().length >= 2)

const enterLobby = () => {
  if (isReady.value) {
    localStorage.setItem('pseudo', pseudo.value.trim())
    router.push('/lobby')
  }
}
</script>

<template>
  <div class="home">
    <div class="logo">🔗</div>
    <h1>GuessLink</h1>
    <h2>Trouve les points communs !</h2>
    
    <div class="card">
      <div class="form-group">
        <input 
          v-model="pseudo"
          type="text" 
          placeholder="Entre ton pseudo..."
          maxlength="20"
          @keyup.enter="enterLobby"
        />
      </div>
      
      <button 
        class="primary" 
        :disabled="!isReady"
        @click="enterLobby"
      >
        C'est parti ! 🚀
      </button>
    </div>
    
    <p class="hint">Minimum 2 caractères pour jouer</p>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 500px;
}

.card {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 3rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.form-group {
  width: 100%;
  display: flex;
  justify-content: center;
}

.hint {
  margin-top: 1.5rem;
  font-size: 0.9rem;
  opacity: 0.7;
  animation: slideUp 0.6s ease-out 0.4s both;
}
</style>

