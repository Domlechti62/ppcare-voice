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
  
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isListeningRef = useRef(false);

  const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;
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

  // FONCTION OPTIMISÉE : Synthèse avec Amélie fr-CA
  const speakText = (text) => {
    if (!speechEnabled) return;
    
    console.log('Lecture avec voix optimisée:', selectedVoice?.name || 'par défaut');
    
    try {
      speechSynthesis.cancel();
      
      // CORRECTION : Forcer l'initialisation si nécessaire
      if (isIOS && !audioInitialized) {
        console.log('Initialisation audio forcée avant synthèse');
        initializeAudioContext();
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Utiliser la voix sélectionnée (Amélie fr-CA prioritaire)
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
        console.log(`Utilisation de ${selectedVoice.name} (${selectedVoice.lang})`);
      } else {
        utterance.lang = 'fr-FR';
        console.log('Utilisation voix par défaut');
      }
      
      // Configuration optimisée pour la qualité
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => console.log('Synthèse démarrée');
      utterance.onend = () => console.log('Synthèse terminée');
      utterance.onerror = (e) => console.error('Erreur synthèse:', e.error);
      
      speechSynthesis.speak(utterance);
      
    } catch (error) {
      console.error('Erreur synthèse vocale:', error);
    }
  };

  // Test de la voix sélectionnée - FONCTION RESTAURÉE
  const testSelectedVoice = () => {
    initializeAudioContext();
    speakText("Bonjour, je suis Amélie, votre assistante PPC avec une voix française de qualité optimale.");
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

  useEffect(() => {
    initVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = initVoices;
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
              content: "Tu es PPCare, assistant vocal expert PPC (apnée du sommeil). MISSION: Aider avec équipement PPC UNIQUEMENT (masques, machines CPAP, accessoires). SÉCURITÉ: JAMAIS de diagnostic médical. Redirection médecin si nécessaire. STYLE: Réponses courtes (<200 mots), langage simple et rassurant."
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
        setTimeout(() => speakText(welcomeMessage), 1000);
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
                className="bg-red-500 hover:bg-red-600 p-4 rounded-full transition-all transform hover:scale-105 shadow-lg mr-2"
                title="Retour à l'accueil"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m0 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10m-9 4h2m2-6a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
            )}
            
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10">
              <img 
                src="/logo_domtech.png" 
                alt="Dom Tech & Services" 
                className="w-8 h-8 object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold">PPCare Voice</h1>
              <p className="text-green-400 text-xs">
                {isIOS ? (isIPad ? 'iPad' : 'iPhone') : 'PC'} • {voiceInfo}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm ${
              connectionStatus === 'connected' 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
              } animate-pulse`}></div>
              <span>{connectionStatus === 'connected' ? 'OK' : 'Erreur'}</span>
            </div>
            
            <button
              onClick={() => setSpeechEnabled(!speechEnabled)}
              className={`p-4 rounded-full transition-all ${
                speechEnabled 
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                  : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
              }`}
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
              className="px-3 py-2 rounded-full text-white transition-all hover:scale-105 text-xs"
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
        <div className={`border rounded-xl p-4 mb-6 ${
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
              ? `Voix optimisée: ${selectedVoice?.name || 'Chargement...'} • Audio: ${audioInitialized ? 'Activé' : 'Cliquez pour activer'} • Plateforme: ${isIOS ? (isIPad ? 'iPad Safari' : 'iPhone Safari') : 'Desktop'}`
              : 'Configurez la variable d\'environnement REACT_APP_OPENAI_API_KEY dans Vercel.'
            }
          </p>
        </div>

        {!conversationActive ? (
          <div className="text-center py-12">
            <div className="mb-12">
              <div className="w-32 h-32 mx-auto mb-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center relative">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill="currentColor"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="2"/>
                  <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
                  <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <div className="absolute inset-0 rounded-full bg-green-400/30 animate-ping"></div>
              </div>
              
              <h2 className="text-4xl font-bold mb-4">PPCare Voice</h2>
              <p className="text-xl text-blue-200 mb-8 max-w-2xl mx-auto leading-relaxed">
                Assistant vocal PPC avec voix Amélie optimisée pour {isIOS ? 'iOS' : 'tous les appareils'}.
              </p>
              
              <button
                onClick={startConversation}
                disabled={!OPENAI_API_KEY}
                className={`px-8 py-4 rounded-full text-xl font-medium transition-all transform shadow-lg ${
                  OPENAI_API_KEY
                    ? 'hover:scale-105 bg-gradient-from-green-500 to-green-600 border-green-400' 
                    : 'opacity-50 cursor-not-allowed bg-gray-500'
                }`}
                style={{
                  background: OPENAI_API_KEY ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : undefined,
                  border: OPENAI_API_KEY ? '2px solid #34d399' : undefined
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

            {/* MODE D'EMPLOI ET CADRE UNIVERSEL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
              <div className="bg-white/5 backdrop-blur rounded-xl p-6">
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
              <div className="bg-white/5 backdrop-blur rounded-xl p-6">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-yellow-400 mx-auto mb-2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>
                </svg>
                <p className="text-xl font-bold text-white">Universel</p>
                <p className="text-blue-200 text-sm">PC, iPhone, iPad</p>
              </div>
            </div>
          </div>
        ) : (
          // Interface de conversation
          <div className="py-6">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 mb-6 min-h-[400px] max-h-[500px] overflow-y-auto">
              {conversationHistory.length === 0 ? (
                <div className="text-center text-blue-200 py-8">
                  <p>Conversation initialisée...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {conversationHistory.map((msg, index) => (
                    <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`lg:max-w-md p-4 rounded-2xl ${
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

            {transcript && (
              <div className="bg-blue-500/20 backdrop-blur rounded-xl p-4 mb-4 border border-blue-400/30">
                <p className="text-blue-400 text-sm font-medium mb-2">Je vous écoute...</p>
                <p className="text-white leading-relaxed">{transcript}</p>
              </div>
            )}

            <div className="text-center">
              {isProcessing ? (
                <div className="py-6">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                    <div className="flex space-x-1">
                      <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
                      <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                  <p className="text-blue-200">Amélie réfléchit...</p>
                </div>
              ) : (
                <div className="py-4">
                  <button
                    onClick={toggleListening}
                    disabled={!OPENAI_API_KEY}
                    className={`w-24 h-24 rounded-full transition-all transform shadow-2xl ${
                      !OPENAI_API_KEY 
                        ? 'bg-gray-500 opacity-50 cursor-not-allowed'
                        : isListening 
                          ? 'bg-red-500 hover:bg-red-600 animate-pulse scale-110' 
                          : 'bg-gradient-to-r from-green-500 to-blue-600 hover:scale-105'
                    }`}
                  >
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-white mx-auto">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill="currentColor"/>
                      <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="2"/>
                      <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
                      <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </button>
                  
                  <div className="mt-4">
                    <p className="text-lg text-blue-200 font-medium">
                      {!OPENAI_API_KEY 
                        ? 'Configuration requise'
                        : isListening 
                          ? 'Amélie vous écoute...' 
                          : 'Cliquez pour parler à Amélie'
                      }
                    </p>
                  </div>
                </div>
              )}
              
              {/* BOUTONS AVEC TEST AMÉLIE RESTAURÉ */}
              <div className="flex justify-center space-x-4 mt-4">
                <button
                  onClick={() => {
                    // Arrêter uniquement la synthèse vocale
                    speechSynthesis.cancel();
                    console.log('Synthèse vocale interrompue');
                  }}
                  className="px-6 py-3 rounded-full text-white transition-colors"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: '1px solid #34d399'
                  }}
                >
                  Arrêter l'écoute
                </button>
                
                <button
                  onClick={testSelectedVoice}
                  className="px-6 py-3 rounded-full text-white transition-colors"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: '1px solid #fbbf24'
                  }}
                >
                  Test Amélie
                </button>
                
                <button
                  onClick={() => {
                    // Effacer toute la conversation et revenir à l'accueil
                    speechSynthesis.cancel();
                    setConversationHistory([]);
                    setResponse('');
                    setTranscript('');
                    if (isListening) stopListening();
                    setConversationActive(false);
                  }}
                  className="px-6 py-3 rounded-full text-white transition-colors"
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

        {/* FOOTER REMONTÉ ET PLUS VISIBLE */}
        <div className="text-center text-blue-200 text-sm py-6 mt-8 border-t border-white/10 bg-white/5 backdrop-blur rounded-t-xl">
          <p className="mb-3 text-base font-medium">PPCare Voice - Version finale optimisée Amélie</p>
          <div className="space-y-2">
            <p className="text-blue-300">Développé par Dom Tech & Services</p>
            <div className="flex justify-center space-x-6 text-blue-300">
              <a href="mailto:contact@dom-tech-services.fr" className="hover:text-white transition-colors underline">
                contact@dom-tech-services.fr
              </a>
              <a href="https://www.dom-tech-services.fr/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors underline">
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
