// audioUtils.js - Gestionnaire audio optimisé iOS/Safari pour seniors
// CORRECTION SPÉCIALE iPad + iOS ancien
// Compatible iPhone, iPad, Android avec fallbacks intelligents

// Détection de l'environnement AMÉLIORÉE
const isIOS = () => {
  // Détection standard
  const standardIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  // Détection iPad moderne (se présente comme MacIntel)
  const modernIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  
  // Détection supplémentaire pour iPad
  const iPadUA = /iPad/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && 'ontouchend' in document);
  
  const result = standardIOS || modernIPad || iPadUA;
  console.log(`🔍 Détection iOS: standard=${standardIOS}, modernIPad=${modernIPad}, iPadUA=${iPadUA}, result=${result}`);
  return result;
};

const isSafari = () => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Détection spécifique iPad
const isIPad = () => {
  return /iPad/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Détection version iOS
const getIOSVersion = () => {
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
  if (match) {
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3] || 0, 10)
    };
  }
  return null;
};

// Conversion base64 vers blob audio avec validation
export const base64ToBlob = (base64Data, contentType) => {
  try {
    // Nettoyer les données base64
    const cleanBase64 = base64Data.replace(/^data:audio\/[^;]+;base64,/, '');
    
    const byteCharacters = atob(cleanBase64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  } catch (err) {
    console.error('Erreur conversion base64:', err);
    return null;
  }
};

// Gestionnaire audio OpenAI avec compatibilité iOS optimisée + CORRECTION iPad
export class OpenAIAudioPlayer {
  constructor() {
    this.currentAudio = null;
    this.audioUrl = null;
    this.isPlaying = false;
    
    // Variables pour iOS/Safari
    this.audioContext = null;
    this.source = null;
    this.gainNode = null;
    this.isIOS = isIOS();
    this.isSafari = isSafari();
    this.isMobile = isMobile();
    this.isIPad = isIPad();
    this.iosVersion = getIOSVersion();
    
    // Configuration spécifique iOS avec correction iPad
    this.iosVolumeMultiplier = this.isIOS ? 3.0 : 2.5;
    
    // NOUVEAU: Détection des capacités audio
    this.audioCapabilities = this.detectAudioCapabilities();
    
    console.log(`🔍 Environnement détecté: iOS=${this.isIOS}, iPad=${this.isIPad}, Safari=${this.isSafari}, Mobile=${this.isMobile}`);
    console.log(`📱 Version iOS:`, this.iosVersion);
    console.log(`🎵 Capacités audio:`, this.audioCapabilities);
  }

  // NOUVEAU: Détection des capacités audio du device
  detectAudioCapabilities() {
    const capabilities = {
      webAudio: !!(window.AudioContext || window.webkitAudioContext),
      htmlAudio: !!window.Audio,
      autoplay: 'unknown', // Sera testé dynamiquement
      gainNode: false,
      needsInteraction: this.isIOS || (this.isSafari && this.isMobile)
    };
    
    // Test spécifique pour iPad - peut avoir besoin d'AudioContext même si iOS
    if (this.isIPad) {
      capabilities.iPadNeedsWebAudio = true;
      capabilities.gainNode = capabilities.webAudio;
    }
    
    // iOS < 16 a des limitations spéciales
    if (this.iosVersion && this.iosVersion.major < 16) {
      capabilities.oldIOS = true;
      capabilities.needsInteraction = true;
      capabilities.autoplay = false;
    }
    
    return capabilities;
  }

  async playAudio(audioBase64, audioFormat = 'mp3', onStart = null, onEnd = null, onError = null) {
    try {
      // Nettoyer l'audio précédent
      this.cleanup();

      console.log('🎵 Démarrage lecture audio avec correction iPad/iOS ancien...');
      
      // Créer le blob audio
      const mimeType = audioFormat === 'mp3' ? 'audio/mpeg' : `audio/${audioFormat}`;
      const audioBlob = base64ToBlob(audioBase64, mimeType);
      
      if (!audioBlob) {
        throw new Error('Impossible de créer le blob audio');
      }

      // Créer l'URL et l'objet Audio
      this.audioUrl = URL.createObjectURL(audioBlob);
      this.currentAudio = new Audio(this.audioUrl);
      
      // NOUVEAU: Configuration spécifique selon les capacités détectées
      await this.configureAudioForDevice();
      
      // Configuration des événements
      this.setupAudioEvents(onStart, onEnd, onError);
      
      // NOUVEAU: Méthode de lecture adaptée au device
      await this.startPlaybackForDevice();
      
      return true;

    } catch (err) {
      console.error('❌ Erreur playAudio:', err);
      this.isPlaying = false;
      this.cleanup();
      
      // Gérer les erreurs iOS spécifiques avec messages adaptés
      if (this.isIOS && err.name === 'NotAllowedError') {
        console.warn('🎵 Erreur iOS: Interaction utilisateur requise');
        const message = this.isIPad ? 
          'Tapez l\'écran de votre iPad puis réessayez' : 
          'Tapez l\'écran de votre iPhone puis réessayez';
        if (onError) onError(new Error(message));
      } else if (onError) {
        onError(err);
      }
      
      return false;
    }
  }

  // NOUVEAU: Configuration audio adaptée au device
  async configureAudioForDevice() {
    console.log('⚙️ Configuration audio pour device...');
    
    // Configuration de base pour tous les devices
    this.currentAudio.preload = 'auto';
    this.currentAudio.crossOrigin = 'anonymous';
    this.currentAudio.muted = false;
    
    if (this.isIOS) {
      console.log('🍎 Configuration iOS/iPadOS');
      this.currentAudio.volume = 1.0;
      
      // CORRECTION SPÉCIALE POUR iPad - peut nécessiter AudioContext
      if (this.isIPad && this.audioCapabilities.webAudio) {
        console.log('📱 iPad détecté - tentative AudioContext...');
        try {
          await this.setupAudioAmplificationForIPad();
        } catch (error) {
          console.warn('⚠️ AudioContext iPad échoué, fallback volume standard:', error);
        }
      }
      
      // iOS ancien - configuration spéciale
      if (this.audioCapabilities.oldIOS) {
        console.log('📱 iOS ancien détecté - configuration restrictive');
        this.currentAudio.preload = 'metadata'; // Moins agressif
      }
      
    } else {
      // Amplification pour autres navigateurs
      try {
        console.log('🔊 Configuration amplification audio non-iOS');
        await this.setupAudioAmplification();
      } catch (amplifyError) {
        console.warn('⚠️ Amplification non disponible, volume normal:', amplifyError);
        this.currentAudio.volume = 1.0;
      }
    }
  }

  // NOUVEAU: AudioContext spécial pour iPad
  async setupAudioAmplificationForIPad() {
    console.log('📱 Configuration AudioContext spécial iPad...');
    
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Attendre que l'audio soit prêt
    await new Promise((resolve) => {
      if (this.currentAudio.readyState >= 2) {
        resolve();
      } else {
        this.currentAudio.addEventListener('canplay', resolve, { once: true });
      }
    });
    
    this.source = this.audioContext.createMediaElementSource(this.currentAudio);
    this.gainNode = this.audioContext.createGain();
    
    // Amplification modérée pour iPad
    this.gainNode.gain.value = 2.0;
    
    // Connecter : source -> gain -> destination
    this.source.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    
    console.log('📱 AudioContext iPad configuré avec succès');
  }

  async setupAudioAmplification() {
    // Amplification audio pour navigateurs non-iOS (code existant)
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.source = this.audioContext.createMediaElementSource(this.currentAudio);
    this.gainNode = this.audioContext.createGain();
    
    // Amplification adaptée à l'environnement
    this.gainNode.gain.value = this.iosVolumeMultiplier;
    
    // Connecter : source -> gain -> destination
    this.source.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    
    console.log(`🔊 Amplification audio activée (${this.iosVolumeMultiplier}x)`);
  }

  // NOUVEAU: Démarrage lecture adapté au device
  async startPlaybackForDevice() {
    console.log('▶️ Démarrage lecture adapté au device...');
    
    if (this.isIOS) {
      await this.handleIOSPlayback();
    } else {
      // Reprendre le contexte audio si suspendu (politique navigateur)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Démarrer la lecture
      await this.currentAudio.play();
    }
  }

  setupAudioEvents(onStart, onEnd, onError) {
    // Événements détaillés pour debug iPad
    this.currentAudio.onloadstart = () => {
      console.log('🎵 Audio loadstart');
      if (onStart) onStart();
    };

    this.currentAudio.oncanplay = () => {
      console.log('🎵 Audio can play');
    };

    this.currentAudio.oncanplaythrough = () => {
      console.log('🎵 Audio can play through');
    };

    this.currentAudio.onplay = () => {
      console.log('🎵 Audio play started');
      this.isPlaying = true;
    };

    this.currentAudio.onplaying = () => {
      console.log('🎵 Audio playing');
      this.isPlaying = true;
    };

    this.currentAudio.onended = () => {
      console.log('✅ Audio terminé');
      this.isPlaying = false;
      this.cleanup();
      if (onEnd) onEnd();
    };

    this.currentAudio.onerror = (e) => {
      console.error('❌ Erreur lecture audio:', e);
      console.error('❌ Détails erreur:', this.currentAudio.error);
      this.isPlaying = false;
      this.cleanup();
      
      // Messages d'erreur adaptés aux seniors avec spécificité device
      let errorMessage = 'Problème de lecture audio. ';
      if (this.isIPad) {
        errorMessage += 'Vérifiez que votre iPad n\'est pas en mode silencieux et que le volume est audible.';
      } else if (this.isIOS) {
        errorMessage += 'Vérifiez que votre iPhone n\'est pas en mode silencieux.';
      } else if (this.isMobile) {
        errorMessage += 'Vérifiez le volume de votre appareil.';
      } else {
        errorMessage += 'Vérifiez le volume de votre ordinateur.';
      }
      
      if (onError) onError(new Error(errorMessage));
    };

    // Gestion des interruptions (appels, notifications)
    this.currentAudio.onpause = () => {
      console.log('⏸️ Audio mis en pause');
      this.isPlaying = false;
    };

    // NOUVEAU: Événements spécifiques pour debug
    this.currentAudio.onstalled = () => {
      console.warn('⚠️ Audio stalled');
    };

    this.currentAudio.onsuspend = () => {
      console.warn('⚠️ Audio suspend');
    };

    this.currentAudio.onwaiting = () => {
      console.warn('⚠️ Audio waiting');
    };
  }

  async handleIOSPlayback() {
    // Gestion spéciale pour iOS/Safari avec améliorations iPad
    console.log('🍎 Gestion lecture iOS/Safari...');
    
    try {
      // Activer AudioContext si disponible et iPad
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Tentative de lecture directe
      const playPromise = this.currentAudio.play();
      
      if (playPromise !== undefined) {
        await playPromise;
      }
      
    } catch (playError) {
      console.warn('🍎 Lecture iOS nécessite interaction utilisateur:', playError);
      
      // Créer un gestionnaire d'interaction utilisateur pour iOS avec message adapté
      const playHandler = async (event) => {
        console.log('👆 Interaction utilisateur détectée:', event.type);
        try {
          // Activer AudioContext si nécessaire
          if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
          }
          
          await this.currentAudio.play();
          document.removeEventListener('touchend', playHandler);
          document.removeEventListener('click', playHandler);
          console.log('✅ Lecture iOS réussie après interaction');
        } catch (retryError) {
          console.error('🍎 Échec lecture iOS après interaction:', retryError);
        }
      };
      
      // Attendre une interaction utilisateur
      document.addEventListener('touchend', playHandler, { once: true });
      document.addEventListener('click', playHandler, { once: true });
      
      const deviceName = this.isIPad ? 'iPad' : 'iPhone';
      throw new Error(`Tapez l'écran de votre ${deviceName} puis réessayez`);
    }
  }

  // Méthodes existantes (stop, cleanup, etc.) - AMÉLIORÉES
  stop() {
    console.log('🛑 Arrêt audio forcé');
    
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }
    
    this.isPlaying = false;
    this.cleanup();
  }

  cleanup() {
    // Nettoyer l'audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      
      // Supprimer tous les event listeners
      this.currentAudio.onloadstart = null;
      this.currentAudio.oncanplay = null;
      this.currentAudio.oncanplaythrough = null;
      this.currentAudio.onplay = null;
      this.currentAudio.onplaying = null;
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.onpause = null;
      this.currentAudio.onstalled = null;
      this.currentAudio.onsuspend = null;
      this.currentAudio.onwaiting = null;
      
      this.currentAudio = null;
    }
    
    // Nettoyer l'URL
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = null;
    }
    
    // Nettoyer le contexte audio - CORRECTION: inclure iPad
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {
        console.warn('Erreur déconnexion source:', e);
      }
      this.source = null;
    }
    
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch (e) {
        console.warn('Erreur déconnexion gainNode:', e);
      }
      this.gainNode = null;
    }
    
    // CORRECTION: Ne pas fermer AudioContext sur iOS/iPad (peut causer des problèmes)
    if (this.audioContext && !this.isIOS) {
      if (this.audioContext.state !== 'closed') {
        try {
          this.audioContext.close();
        } catch (e) {
          console.warn('Erreur fermeture contexte audio:', e);
        }
      }
      this.audioContext = null;
    }
  }

  getIsPlaying() {
    return this.isPlaying;
  }

  // Ajustement volume en temps réel avec correction iPad
  setVolume(level) {
    if (this.currentAudio) {
      this.currentAudio.volume = Math.min(1.0, level);
    }
    
    // Ajustement gainNode - CORRECTION: inclure iPad
    if (this.gainNode && (this.isIPad || !this.isIOS)) {
      this.gainNode.gain.value = level;
      console.log(`🔊 Volume ajusté à ${level}x`);
    }
  }

  // NOUVEAU: Méthode de diagnostic pour iPad
  async diagnoseAudioIssues() {
    console.log('🔍 === DIAGNOSTIC AUDIO DEVICE ===');
    console.log('Device:', {
      isIOS: this.isIOS,
      isIPad: this.isIPad,
      isSafari: this.isSafari,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints
    });
    
    console.log('iOS Version:', this.iosVersion);
    console.log('Audio Capabilities:', this.audioCapabilities);
    
    if (this.audioContext) {
      console.log('AudioContext:', {
        state: this.audioContext.state,
        sampleRate: this.audioContext.sampleRate,
        baseLatency: this.audioContext.baseLatency
      });
    }
    
    // Test audio simple
    try {
      const testAudio = new Audio();
      testAudio.volume = 0.1;
      const canPlay = await new Promise((resolve) => {
        testAudio.oncanplay = () => resolve(true);
        testAudio.onerror = () => resolve(false);
        testAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAAAAAEAAQBAAQAAgD4AAQACABAAZGF0YQAAAAA=';
      });
      console.log('Test audio basique:', canPlay ? '✅' : '❌');
    } catch (error) {
      console.log('Test audio basique: ❌', error);
    }
  }

  // Méthodes existantes conservées...
  static async testAudioSupport() {
    const support = {
      ios: isIOS(),
      ipad: isIPad(),
      safari: isSafari(),
      mobile: isMobile(),
      iosVersion: getIOSVersion(),
      webAudio: !!(window.AudioContext || window.webkitAudioContext),
      mediaDevices: !!navigator.mediaDevices,
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    };
    
    console.log('🔍 Support audio détecté:', support);
    return support;
  }

  async prepareIOSAudio() {
    if (!this.isIOS) return true;
    
    try {
      // Créer un contexte audio silencieux pour "débloquer" iOS
      const tempContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = tempContext.createOscillator();
      const gain = tempContext.createGain();
      
      oscillator.connect(gain);
      gain.connect(tempContext.destination);
      gain.gain.value = 0; // Silencieux
      
      oscillator.start();
      oscillator.stop(tempContext.currentTime + 0.01);
      
      await tempContext.close();
      
      console.log('🍎 Audio iOS préparé avec succès');
      return true;
      
    } catch (error) {
      console.warn('🍎 Échec préparation audio iOS:', error);
      return false;
    }
  }
}

// Fonction utilitaire pour initialiser l'audio sur iOS après interaction
export const initIOSAudio = async () => {
  if (!isIOS()) return true;
  
  console.log('🍎 Initialisation audio iOS...');
  
  try {
    const player = new OpenAIAudioPlayer();
    return await player.prepareIOSAudio();
  } catch (error) {
    console.error('🍎 Erreur initialisation iOS:', error);
    return false;
  }
};

// Export des fonctions utilitaires
export { isIOS, isSafari, isMobile, isIPad, getIOSVersion };