import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const App = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [conversationActive, setConversationActive] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [voiceInfo, setVoiceInfo] = useState('Chargement...');
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false); // NOUVEAU: État de synthèse vocale
  
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isListeningRef = useRef(false);

  const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;
  const AZURE_SPEECH_KEY = process.env.REACT_APP_AZURE_SPEECH_KEY;
  const AZURE_SPEECH_REGION = process.env.REACT_APP_AZURE_SPEECH_REGION;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isIPad = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // FONCTION OPTIMISÉE : Sélection prioritaire d'Amélie fr-CA
  const selectOptimalVoice = () => {
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) return null;
    
    console.log('=== SÉLECTION OPTIMISÉE AMÉLIE ===');
    
    // 1. PRIORITÉ ABSOLUE : Amélie fr-CA
    const amelieVoice = voices.find(voice => 
      voice.name.toLowerCase().includes('amélie') && 
      voice.lang.includes('fr-CA')
    );
    
    if (amelieVoice) {
      console.log('✅ Voix Amélie fr-CA trouvée:', amelieVoice.name);
      setSelectedVoice(amelieVoice);
      setVoiceInfo(`Amélie (fr-CA) - Qualité optimale`);
      return amelieVoice;
    }
    
    // 2. FALLBACK : Toute voix Amélie française
    const amelieAnyFrench = voices.find(voice => 
      voice.name.toLowerCase().includes('amélie') && 
      voice.lang.startsWith('fr')
    );
    
    if (amelieAnyFrench) {
      console.log('⚠️ Voix Amélie trouvée (autre région):', amelieAnyFrench.name, amelieAnyFrench.lang);
      setSelectedVoice(amelieAnyFrench);
      setVoiceInfo(`Amélie (${amelieAnyFrench.lang}) - Bonne qualité`);
      return amelieAnyFrench;
    }
    
    // 3. FALLBACK : Autres voix françaises de qualité
    const qualityFrenchVoices = [
      'Thomas', 'Audrey', 'Virginie', 'Céline'
    ];
    
    for (const voiceName of qualityFrenchVoices) {
      const voice = voices.find(v => 
        v.name.toLowerCase().includes(voiceName.toLowerCase()) && 
        v.lang.startsWith('fr')
      );
      
      if (voice) {
        console.log('⚠️ Fallback vers voix française de qualité:', voice.name);
        setSelectedVoice(voice);
        setVoiceInfo(`${voice.name} - Qualité correcte`);
        return voice;
      }
    }
    
    // 4. DERNIÈRE OPTION : Première voix française disponible
    const anyFrenchVoice = voices.find(v => v.lang.startsWith('fr'));
    
    if (anyFrenchVoice) {
      console.log('⚠️ Utilisation voix française basique:', anyFrenchVoice.name);
      setSelectedVoice(anyFrenchVoice);
      setVoiceInfo(`${anyFrenchVoice.name} - Qualité variable`);
      return anyFrenchVoice;
    }
    
    // 5. TRÈS DERNIÈRE OPTION : Voix par défaut
    console.log('❌ Aucune voix française trouvée, utilisation voix par défaut');
    setSelectedVoice(voices[0]);
    setVoiceInfo('Voix par défaut (non française)');
    return voices[0];
  };

  const initializeAudioContext = () => {
    if (isIOS && !audioInitialized) {
      const utterance = new SpeechSynthesisUtterance('');
      utterance.volume = 0;
      speechSynthesis.speak(utterance);
      setAudioInitialized(true);
      console.log('Audio iOS initialisé');
    }
  };

  // FONCTION INTÉGRÉE : Synthèse avec Azure Speech ou fallback natif
  const speakText = async (text) => {
    if (!speechEnabled) return;
    
    console.log('Synthèse vocale demandée pour:', text.substring(0, 50) + '...');
    
    // Essayer Azure Speech en priorité si configuré
    if (AZURE_SPEECH_KEY && AZURE_SPEECH_REGION) {
      try {
        const success = await speakWithAzure(text);
        if (success) return; // Succès Azure, on s'arrête là
      } catch (error) {
        console.warn('Azure Speech échec, fallback vers synthèse native:', error);
      }
    }
    
    // Fallback vers synthèse native
    speakWithNativeSynthesis(text);
  };

  // NOUVELLE FONCTION : Synthèse avec Azure Speech Services
  const speakWithAzure = async (text) => {
    console.log('Tentative synthèse Azure Speech...');
    
    try {
      // Pour les tests silencieux de pré-initialisation
      if (text === 'test') {
        setIsSpeaking(false);
      } else {
        setIsSpeaking(true);
      }
      
      // Configuration de la requête Azure avec voix française premium
      const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">
          <voice name="fr-FR-DeniseNeural">
            <prosody rate="0.9" pitch="0%">
              ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </prosody>
          </voice>
        </speak>
      `;
      
      const response = await fetch(`https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
        },
        body: ssml
      });
      
      if (!response.ok) {
        throw new Error(`Azure Speech API error: ${response.status}`);
      }
      
      // Conversion en audio et lecture
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      // Pour les tests silencieux, on ne joue pas l'audio
      if (text === 'test') {
        URL.revokeObjectURL(audioUrl);
        console.log('Azure Speech: pré-initialisation réussie');
        return true;
      }
      
      // Gestion des événements audio pour la lecture normale
      audio.onplay = () => {
        console.log('Azure Speech: lecture démarrée');
        setIsSpeaking(true);
      };
      
      audio.onended = () => {
        console.log('Azure Speech: lecture terminée');
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl); // Nettoyage mémoire
      };
      
      audio.onerror = () => {
        console.error('Azure Speech: erreur de lecture audio');
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        throw new Error('Erreur lecture audio Azure');
      };
      
      // Démarrer la lecture
      await audio.play();
      console.log('Azure Speech: succès');
      return true;
      
    } catch (error) {
      console.error('Erreur Azure Speech:', error);
      setIsSpeaking(false);
      throw error;
    }
  };

  // FONCTION EXISTANTE : Synthèse native (fallback)
  const speakWithNativeSynthesis = (text) => {
    console.log('Utilisation synthèse native du navigateur');
    
    try {
      speechSynthesis.cancel();
      
      if (isIOS && !audioInitialized) {
        console.log('Initialisation audio forcée avant synthèse');
        initializeAudioContext();
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
        console.log(`Utilisation de ${selectedVoice.name} (${selectedVoice.lang})`);
      } else {
        utterance.lang = 'fr-FR';
        console.log('Utilisation voix par défaut');
      }
      
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => {
        console.log('Synthèse native démarrée');
        setIsSpeaking(true);
      };
      
      utterance.onend = () => {
        console.log('Synthèse native terminée');
        setIsSpeaking(false);
      };
      
      utterance.onerror = (e) => {
        console.error('Erreur synthèse native:', e.error);
        setIsSpeaking(false);
      };
      
      speechSynthesis.speak(utterance);
      
    } catch (error) {
      console.error('Erreur synthèse vocale native:', error);
      setIsSpeaking(false);
    }
  };

  // MISE À JOUR : Test de la voix avec Azure ou native
  const testSelectedVoice = () => {
    initializeAudioContext();
    speakText("Bonjour, je suis votre assistante PPC avec la nouvelle synthèse vocale Azure de qualité premium");
  };

  // MISE À JOUR : Fonction d'arrêt pour gérer les deux types de synthèse
  const stopAllSpeech = () => {
    // Arrêter synthèse native
    speechSynthesis.cancel();
    
    // Arrêter tous les éléments audio (Azure)
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    
    setIsSpeaking(false);
    console.log('Toute synthèse vocale interrompue');
  };

  // MISE À JOUR : Indicateur de statut vocal amélioré
  const getVoiceStatusInfo = () => {
    if (AZURE_SPEECH_KEY && AZURE_SPEECH_REGION) {
      return `Azure Speech (Denise Neural) - Qualité premium`;
    } else if (selectedVoice) {
      return `${selectedVoice.name} - Qualité standard`;
    } else {
      return 'Voix par défaut - Qualité basique';
    }
  };

  const initVoices = () => {
    const voices = speechSynthesis.getVoices();
    console.log('Initialisation des voix, total disponibles:', voices.length);
    
    if (voices.length > 0) {
      const optimalVoice = selectOptimalVoice();
      
      // Log pour vérification
      const amelieVoices = voices.filter(v => 
        v.name.toLowerCase().includes('amélie')
      );
      
      console.log('Voix Amélie disponibles:', amelieVoices.map(v => 
        `${v.name} (${v.lang})`
      ));
      
      if (optimalVoice) {
        console.log('Voix finale sélectionnée:', optimalVoice.name, optimalVoice.lang);
      }
    }
  };

  // NOUVEAU : Pré-initialisation d'Azure Speech pour iOS
  const initializeAzureSpeech = async () => {
    if (AZURE_SPEECH_KEY && AZURE_SPEECH_REGION && isIOS) {
      try {
        console.log('Pré-initialisation Azure Speech pour iOS...');
        // Test silencieux pour "réveiller" Azure Speech
        await speakWithAzure('test');
      } catch (error) {
        console.log('Pré-initialisation Azure terminée');
      }
    }
  };

  useEffect(() => {
    initVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = initVoices;
    }
    
    // NOUVEAU : Initialiser Azure dès le chargement sur iOS
    if (isIOS) {
      setTimeout(() => initializeAzureSpeech(), 1000);
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'fr-FR';
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript.trim()) {
          setTranscript(finalTranscript);
          clearTimeout(silenceTimerRef.current);
          
          if (isListeningRef.current && !isProcessing) {
            silenceTimerRef.current = setTimeout(() => {
              if (isListeningRef.current && !isProcessing && finalTranscript.trim()) {
                stopListening();
                setTimeout(() => {
                  handleSpeechSubmit(finalTranscript.trim());
                }, 100);
              }
            }, 2500);
          }
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Erreur reconnaissance:', event.error);
        setIsListening(false);
        isListeningRef.current = false;
        setConnectionStatus('error');
        
        if (event.error === 'not-allowed') {
          alert('Microphone bloqué. Autorisez l\'accès dans les réglages de votre navigateur.');
        }
        
        setTimeout(() => setConnectionStatus('connected'), 3000);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        isListeningRef.current = false;
        clearTimeout(silenceTimerRef.current);
      };

      recognitionRef.current.onstart = () => {
        console.log('Reconnaissance démarrée');
      };
    }
  }, [isProcessing]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else if (!isProcessing) {
      startListening();
    }
  };

  const startListening = async () => {
    if (!recognitionRef.current || isListening || isProcessing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      setIsListening(true);
      isListeningRef.current = true;
      setTranscript('');
      setConnectionStatus('connected');
      
      recognitionRef.current.start();
      
    } catch (error) {
      console.error('Permission microphone refusée:', error);
      setConnectionStatus('error');
      
      const message = isIOS 
        ? "Autorisez le microphone dans Réglages > Safari > Microphone"
        : "Autorisez l'accès au microphone pour utiliser la fonction vocale";
      alert(message);
    }
  };

  const stopListening = () => {
    setIsListening(false);
    isListeningRef.current = false;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.warn('Erreur arrêt reconnaissance:', error);
      }
    }
    
    clearTimeout(silenceTimerRef.current);
  };

  const handleSpeechSubmit = async (speechText) => {
    if (!speechText.trim()) return;

    if (!OPENAI_API_KEY) {
      const errorMessage = "Clé API OpenAI manquante. Vérifiez la configuration des variables d'environnement.";
      setResponse(errorMessage);
      const errorMsg = { 
        type: 'assistant', 
        content: errorMessage, 
        timestamp: Date.now() 
      };
      setConversationHistory(prev => [...prev, errorMsg]);
      return;
    }

    setIsProcessing(true);
    setTranscript('');
    
    const userMessage = { 
      type: 'user', 
      content: speechText, 
      timestamp: Date.now() 
    };
    setConversationHistory(prev => [...prev, userMessage]);

    try {
      const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system", 
              content: "Tu es PPCare, assistant vocal expert en traitement par PPC (Pression Positive Continue) pour l'apnée du sommeil. MISSION: Aider exclusivement avec les équipements de traitement par PPC : machines PPC, masques, accessoires et maintenance. TERMINOLOGIE OBLIGATOIRE: Utilise UNIQUEMENT 'PPC' ou 'Pression Positive Continue'. Dis 'machine PPC' ou 'appareil PPC'. Dis 'traitement par PPC'. INTERDICTION ABSOLUE d'utiliser le terme anglais 'CPAP'. SÉCURITÉ: JAMAIS de diagnostic médical. Redirige vers un médecin pour toute question médicale. STYLE: Réponses courtes (<200 mots), langage simple, naturel et rassurant. Ton français professionnel et bienveillant."
            },
            {
              role: "user", 
              content: speechText
            }
          ],
          max_tokens: 300,
          temperature: 0.7
        })
      });

      if (!apiResponse.ok) {
        throw new Error(`Erreur OpenAI: ${apiResponse.status}`);
      }

      const data = await apiResponse.json();
      const aiResponse = data.choices[0].message.content.trim();
      
      const assistantMessage = { 
        type: 'assistant', 
        content: aiResponse, 
        timestamp: Date.now() 
      };
      
      setResponse(aiResponse);
      setConversationHistory(prev => [...prev, assistantMessage]);

      // Synthèse avec voix optimisée
      if (speechEnabled) {
        setTimeout(() => speakText(aiResponse), 300);
      }

    } catch (error) {
      console.error('Erreur complète:', error);
      
      let errorMessage = "Désolé, je n'ai pas pu traiter votre demande. ";
      if (error.message.includes('401')) {
        errorMessage += "Vérifiez votre clé API OpenAI.";
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage += "Vérifiez votre connexion internet.";
      } else {
        errorMessage += "Pouvez-vous répéter votre question ?";
      }
      
      setResponse(errorMessage);
      
      const errorMsg = { 
        type: 'assistant', 
        content: errorMessage, 
        timestamp: Date.now() 
      };
      setConversationHistory(prev => [...prev, errorMsg]);
      
      setConnectionStatus('error');
      setTimeout(() => setConnectionStatus('connected'), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const startConversation = () => {
    initializeAudioContext();
    setConversationActive(true);
    setConversationHistory([]);
    
    const welcomeMessage = "Bonjour ! Je suis votre assistant PPC personnel. Comment puis-je vous aider aujourd'hui ?";
    
    setTimeout(() => {
      const assistantMessage = {
        type: 'assistant', 
        content: welcomeMessage, 
        timestamp: Date.now()
      };
      setConversationHistory([assistantMessage]);
      
      if (speechEnabled) {
        // CORRECTION iOS : Délai plus long pour assurer qu'Azure soit prêt
        setTimeout(() => speakText(welcomeMessage), 2000);
      }
    }, 500);
  };

  const returnToHome = () => {
    setIsListening(false);
    isListeningRef.current = false;
    setConversationActive(false);
    setConversationHistory([]);
    setResponse('');
    setTranscript('');
    setIsProcessing(false);
    setIsSpeaking(false); // NOUVEAU: Reset état synthèse
    clearTimeout(silenceTimerRef.current);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
        recognitionRef.current.stop();
      } catch (error) {
        console.warn('Erreur arrêt reconnaissance:', error);
      }
    }
    
    speechSynthesis.cancel();
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen text-white">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            {conversationActive && (
              <button
                onClick={returnToHome}
                className="bg-red-500 hover:bg-red-600 p-4 rounded-full transition-all transform hover:scale-105 shadow-lg mr-2 button-hover-animation"
                title="Retour à l'accueil"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m0 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10m-9 4h2m2-6a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
            )}
            
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 logo-container">
              <img 
                src="/logo_domtech.png" 
                alt="Dom Tech & Services" 
                className="w-8 h-8 object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold">PPCare Voice</h1>
              <p className="text-green-400 text-xs">
                {isIOS ? (isIPad ? 'iPad' : 'iPhone') : 'PC'} • {getVoiceStatusInfo()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Indicateur de statut avec animation améliorée */}
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm transition-all duration-500 ${
              connectionStatus === 'connected' 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full status-indicator ${
                connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
              }`}></div>
              <span>{connectionStatus === 'connected' ? 'OK' : 'Erreur'}</span>
            </div>
            
            {/* Bouton synthèse vocale avec état visuel */}
            <button
              onClick={() => setSpeechEnabled(!speechEnabled)}
              className={`p-4 rounded-full transition-all duration-300 button-hover-animation ${
                speechEnabled 
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                  : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
              } ${isSpeaking ? 'speaking-animation' : ''}`}
              title={speechEnabled ? `Voix: ${selectedVoice?.name || 'Par défaut'}` : 'Synthèse désactivée'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="2"/>
                {speechEnabled ? (
                  <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="2"/>
                ) : (
                  <>
                    <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2"/>
                    <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2"/>
                  </>
                )}
              </svg>
            </button>

            {/* BOUTON TEST AMÉLIE RESTAURÉ */}
            <button
              onClick={testSelectedVoice}
              className="px-3 py-2 rounded-full text-white transition-all hover:scale-105 text-xs button-hover-animation"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: '1px solid #fbbf24'
              }}
            >
              Test Amélie
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6">
        {/* Configuration */}
        <div className={`border rounded-xl p-4 mb-6 fade-in ${
          OPENAI_API_KEY 
            ? 'bg-green-900/20 border-green-500/30' 
            : 'bg-red-900/20 border-red-500/30'
        }`}>
          <h3 className={`font-semibold mb-2 ${
            OPENAI_API_KEY ? 'text-green-400' : 'text-red-400'
          }`}>
            {OPENAI_API_KEY ? '✅ PPCare Voice - Version Optimisée' : '❌ Configuration requise'}
          </h3>
          <p className={`text-sm ${
            OPENAI_API_KEY ? 'text-green-200' : 'text-red-200'
          }`}>
            {OPENAI_API_KEY 
              ? `Voix optimisée: ${getVoiceStatusInfo()} • Audio: ${audioInitialized ? 'Activé' : 'Cliquez pour activer'} • Plateforme: ${isIOS ? (isIPad ? 'iPad Safari' : 'iPhone Safari') : 'Desktop'}`
              : 'Configurez la variable d\'environnement REACT_APP_OPENAI_API_KEY dans Vercel.'
            }
          </p>
        </div>

        {!conversationActive ? (
          <div className="text-center py-12 fade-in">
            <div className="mb-12">
              {/* Logo principal avec animations améliorées */}
              <div className="w-32 h-32 mx-auto mb-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center relative main-logo">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill="currentColor"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="2"/>
                  <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
                  <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <div className="absolute inset-0 rounded-full bg-green-400/30 logo-pulse"></div>
              </div>
              
              <h2 className="text-4xl font-bold mb-4 slide-up">PPCare Voice</h2>
              <p className="text-xl text-blue-200 mb-8 max-w-2xl mx-auto leading-relaxed slide-up delay-200">
                Assistant vocal PPC avec voix Amélie optimisée pour {isIOS ? 'iOS' : 'tous les appareils'}.
              </p>
              
              <button
                onClick={startConversation}
                disabled={!OPENAI_API_KEY}
                className={`px-8 py-4 rounded-full text-xl font-medium transition-all transform shadow-lg main-button slide-up delay-400 ${
                  OPENAI_API_KEY
                    ? 'hover:scale-105 button-ready' 
                    : 'opacity-50 cursor-not-allowed'
                }`}
                style={{
                  background: OPENAI_API_KEY ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#6b7280',
                  border: OPENAI_API_KEY ? '2px solid #34d399' : '2px solid #9ca3af',
                  color: 'white',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '60px',
                  zIndex: 10,
                  position: 'relative'
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="inline mr-3">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill="currentColor"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="2"/>
                  <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
                  <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2"/>
                </svg>
                {OPENAI_API_KEY ? 'Commencer avec Amélie' : 'Configuration requise'}
              </button>
            </div>

            {/* MODE D'EMPLOI avec animations d'entrée */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
              <div className="bg-white/5 backdrop-blur rounded-xl p-6 card-hover slide-up delay-600">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-blue-400 mx-auto mb-2">
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <p className="text-xl font-bold text-white mb-3">Comment utiliser PPCare Voice ?</p>
                <div className="text-left text-blue-200 text-sm space-y-2">
                  <p>• Cliquez pour démarrer une conversation</p>
                  <p>• Posez vos questions (masques, machines PPC, difficultés d'utilisation ou d'adaptation...)</p>
                  <p>• Amélie vous répond</p>
                  <p>• Utilisez "Arrêter l'écoute" pour interrompre l'audio</p>
                </div>
              </div>
              <div className="bg-white/5 backdrop-blur rounded-xl p-6 card-hover slide-up delay-800">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-yellow-400 mx-auto mb-2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>
                </svg>
                <p className="text-xl font-bold text-white">Universel</p>
                <p className="text-blue-200 text-sm">PC, iPhone, iPad</p>
              </div>
            </div>
          </div>
        ) : (
          // Interface de conversation avec animations
          <div className="py-6">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 mb-6 min-h-[400px] max-h-[500px] overflow-y-auto conversation-container">
              {conversationHistory.length === 0 ? (
                <div className="text-center text-blue-200 py-8">
                  <div className="typing-indicator">
                    <p>Conversation initialisée...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {conversationHistory.map((msg, index) => (
                    <div key={index} className={`flex message-animation ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`} style={{animationDelay: `${index * 0.1}s`}}>
                      <div className={`lg:max-w-md p-4 rounded-2xl message-bubble ${
                        msg.type === 'user' 
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white' 
                          : 'bg-white/10 text-white backdrop-blur'
                      }`}>
                        <div className="flex items-center mb-2">
                          <span className="text-xs opacity-70">
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <p className="leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Zone de transcription avec animation */}
            {transcript && (
              <div className="bg-blue-500/20 backdrop-blur rounded-xl p-4 mb-4 border border-blue-400/30 listening-animation">
                <p className="text-blue-400 text-sm font-medium mb-2">Je vous écoute...</p>
                <p className="text-white leading-relaxed">{transcript}</p>
              </div>
            )}

            <div className="text-center">
              {isProcessing ? (
                // Animation de traitement optimisée
                <div className="py-6">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center processing-animation">
                    <div className="flex space-x-1">
                      <div className="w-3 h-3 bg-white rounded-full dot-bounce"></div>
                      <div className="w-3 h-3 bg-white rounded-full dot-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-3 h-3 bg-white rounded-full dot-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                  <p className="text-blue-200">Amélie réfléchit...</p>
                </div>
              ) : (
                <div className="py-4">
                  {/* Bouton microphone principal avec animations contextuelles */}
                  <button
                    onClick={toggleListening}
                    disabled={!OPENAI_API_KEY}
                    className={`w-24 h-24 rounded-full transition-all transform shadow-2xl microphone-button ${
                      !OPENAI_API_KEY 
                        ? 'bg-gray-500 opacity-50 cursor-not-allowed'
                        : isListening 
                          ? 'bg-red-500 hover:bg-red-600 listening-state' 
                          : 'bg-gradient-to-r from-green-500 to-blue-600 hover:scale-105 idle-state'
                    } ${isSpeaking ? 'speaking-response' : ''}`}
                  >
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-white mx-auto">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill="currentColor"/>
                      <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="2"/>
                      <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
                      <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </button>
                  
                  {/* Indicateur visuel d'état avec animations */}
                  <div className="mt-4">
                    <p className={`text-lg font-medium transition-all duration-500 ${
                      !OPENAI_API_KEY 
                        ? 'text-red-400'
                        : isListening 
                          ? 'text-green-400 listening-text' 
                          : isSpeaking 
                            ? 'text-blue-400 speaking-text'
                            : 'text-blue-200'
                    }`}>
                      {!OPENAI_API_KEY 
                        ? 'Configuration requise'
                        : isListening 
                          ? 'Amélie vous écoute...' 
                          : isSpeaking
                            ? 'Amélie vous parle...'
                            : 'Cliquez pour parler à Amélie'
                      }
                    </p>
                    
                    {/* Indicateur visuel pour la synthèse vocale */}
                    {isSpeaking && (
                      <div className="mt-2 flex justify-center">
                        <div className="sound-wave">
                          <div className="wave-bar"></div>
                          <div className="wave-bar"></div>
                          <div className="wave-bar"></div>
                          <div className="wave-bar"></div>
                          <div className="wave-bar"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* BOUTONS AVEC ANIMATIONS AMÉLIORÉES */}
              <div className="flex justify-center space-x-4 mt-4">
                <button
                  onClick={() => {
                    stopAllSpeech();
                    console.log('Toute synthèse vocale interrompue');
                  }}
                  className="px-6 py-3 rounded-full text-white transition-all button-control button-hover-animation"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: '1px solid #34d399'
                  }}
                >
                  Arrêter l'écoute
                </button>
                
                <button
                  onClick={testSelectedVoice}
                  className="px-6 py-3 rounded-full text-white transition-all button-control button-hover-animation"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: '1px solid #fbbf24'
                  }}
                >
                  Test Azure
                </button>
                
                <button
                  onClick={() => {
                    stopAllSpeech();
                    setConversationHistory([]);
                    setResponse('');
                    setTranscript('');
                    if (isListening) stopListening();
                    setConversationActive(false);
                  }}
                  className="px-6 py-3 rounded-full text-white transition-all button-control button-hover-animation"
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    border: '1px solid #f87171'
                  }}
                >
                  Tout effacer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER avec animation */}
        <div className="text-center text-blue-200 text-sm py-6 mt-8 border-t border-white/10 bg-white/5 backdrop-blur rounded-t-xl footer-fade">
          <p className="mb-3 text-base font-medium">PPCare Voice - Version finale optimisée Amélie</p>
          <div className="space-y-2">
            <p className="text-blue-300">Développé par Dom Tech & Services</p>
            <div className="flex justify-center space-x-6 text-blue-300">
              <a href="mailto:contact@dom-tech-services.fr" className="hover:text-white transition-colors underline link-hover">
                contact@dom-tech-services.fr
              </a>
              <a href="https://www.dom-tech-services.fr/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors underline link-hover">
                www.dom-tech-services.fr
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
