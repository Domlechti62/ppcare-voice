imort React, { useState, useRef, useEffect } from 'react';
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
  const [iosInitialized, setIosInitialized] = useState(false);
  
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isListeningRef = useRef(false);

  // Récupération sécurisée de la clé API
  const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;

  // Configuration spécifique iOS/iPad
  useEffect(() => {
    // Détection iOS/iPad
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // Fix CSS pour iOS
      document.body.style.position = 'relative';
      document.body.style.overflow = 'auto';
      document.body.style.height = '100vh';
      document.body.style.webkitOverflowScrolling = 'touch';
      
      // Initialisation synthèse vocale iOS
      const initIOS = () => {
        if (!iosInitialized) {
          const utterance = new SpeechSynthesisUtterance('');
          utterance.volume = 0.01;
          speechSynthesis.speak(utterance);
          setIosInitialized(true);
        }
      };
      
      // Initialiser au premier clic
      document.addEventListener('touchstart', initIOS, { once: true });
      document.addEventListener('click', initIOS, { once: true });
    }
  }, [iosInitialized]);

  // Configuration de la reconnaissance vocale
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
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
                setIsListening(false);
                isListeningRef.current = false;
                clearTimeout(silenceTimerRef.current);
                
                if (recognitionRef.current) {
                  try {
                    recognitionRef.current.abort();
                    recognitionRef.current.stop();
                  } catch (error) {
                    console.warn('Erreur arrêt reconnaissance:', error);
                  }
                }
                
                setTimeout(() => {
                  handleSpeechSubmit(finalTranscript.trim());
                }, 100);
              }
            }, 2500); // Augmenté pour iOS
          }
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Erreur reconnaissance vocale:', event.error);
        setIsListening(false);
        isListeningRef.current = false;
        setConnectionStatus('error');
        setTimeout(() => setConnectionStatus('connected'), 5000);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        isListeningRef.current = false;
        clearTimeout(silenceTimerRef.current);
      };

      recognitionRef.current.onstart = () => {
        console.log('Reconnaissance vocale démarrée');
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

  const startListening = () => {
    if (recognitionRef.current && !isListening && !isProcessing) {
      // Initialisation spécifique iOS avant de démarrer
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      
      if (isIOS && !iosInitialized) {
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0.01;
        speechSynthesis.speak(utterance);
        setIosInitialized(true);
      }
      
      navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
        .then(() => {
          setIsListening(true);
          isListeningRef.current = true;
          setTranscript('');
          setConnectionStatus('connected');
          
          try {
            recognitionRef.current.start();
          } catch (error) {
            console.error('Erreur démarrage reconnaissance:', error);
            setIsListening(false);
            isListeningRef.current = false;
          }
        })
        .catch(error => {
          console.error('Permission microphone refusée:', error);
          setConnectionStatus('error');
          
          const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
          const message = isIOS 
            ? "Pour utiliser la fonction vocale sur iOS, autorisez l'accès au microphone dans Réglages > Safari > Microphone."
            : "Pour utiliser la fonction vocale, autorisez l'accès au microphone.";
          alert(message);
        });
    }
  };

  const stopListening = () => {
    setIsListening(false);
    isListeningRef.current = false;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch (error) {
        console.warn('Erreur arrêt reconnaissance:', error);
      }
    }
    
    clearTimeout(silenceTimerRef.current);
  };

  const handleSpeechSubmit = async (speechText) => {
    if (!speechText.trim()) return;

    // Vérification de la clé API
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
      console.log('Envoi vers OpenAI:', speechText);
      
      // APPEL SÉCURISÉ API OPENAI avec variable d'environnement
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
      
      console.log('Réponse OpenAI:', aiResponse);
      
      const assistantMessage = { 
        type: 'assistant', 
        content: aiResponse, 
        timestamp: Date.now() 
      };
      
      setResponse(aiResponse);
      setConversationHistory(prev => [...prev, assistantMessage]);

      // SYNTHÈSE VOCALE OPTIMISÉE POUR iOS
      if (speechEnabled) {
        console.log('Lecture audio avec synthèse native...');
        
        // Arrêter toute synthèse en cours
        speechSynthesis.cancel();
        
        // Attendre un peu pour iOS
        setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(aiResponse);
          utterance.lang = 'fr-FR';
          utterance.rate = 0.8; // Plus lent pour iOS
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          
          // Événements de synthèse
          utterance.onstart = () => console.log('Synthèse vocale démarrée');
          utterance.onend = () => console.log('Synthèse vocale terminée');
          utterance.onerror = (error) => console.warn('Erreur synthèse vocale:', error);
          
          // iOS nécessite une voix spécifique parfois
          const voices = speechSynthesis.getVoices();
          const frenchVoice = voices.find(voice => voice.lang.startsWith('fr'));
          if (frenchVoice) {
            utterance.voice = frenchVoice;
          }
          
          // Lancer la synthèse
          speechSynthesis.speak(utterance);
        }, 100);
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
    }, 500);
  };

  const handleQuickAction = async (question) => {
    if (!conversationActive) {
      await startConversation();
      setTimeout(() => {
        handleSpeechSubmit(question);
      }, 1000);
    } else {
      await handleSpeechSubmit(question);
    }
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
    
    // Arrêter la synthèse vocale
    speechSynthesis.cancel();
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const quickActions = [
    { 
      text: "Problème masque", 
      color: "bg-gradient-to-br from-red-500 to-red-600",
      question: "J'ai des problèmes de fuite avec mon masque PPC"
    },
    { 
      text: "Machine bruyante", 
      color: "bg-gradient-to-br from-orange-500 to-orange-600",
      question: "Ma machine PPC fait du bruit anormal"
    },
    { 
      text: "Entretien & nettoyage", 
      color: "bg-gradient-to-br from-blue-500 to-blue-600",
      question: "Comment bien nettoyer ma machine PPC ?"
    },
    { 
      text: "Confort sommeil", 
      color: "bg-gradient-to-br from-purple-500 to-purple-600",
      question: "Comment améliorer mon confort avec la PPC ?"
    },
  ];

  // Support de la reconnaissance vocale
  const speechRecognitionSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
      {/* Header */}
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center space-x-3">
            {conversationActive && (
              <button
                onClick={returnToHome}
                className="bg-red-500 hover:bg-red-600 p-3 sm:p-4 rounded-full transition-all transform hover:scale-105 shadow-lg mr-2 sm:mr-4"
                title="Retour à l'accueil"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white sm:w-6 sm:h-6">
                  <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m0 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10m-9 4h2m2-6a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
            )}
            
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center bg-white/10">
              <img 
                src="/logo_domtech.png" 
                alt="Dom Tech & Services" 
                className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold">PPCare Voice</h1>
              <p className="text-green-300 text-xs sm:text-sm">Dom Tech & Services • iOS Optimisé</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => setShowAbout(true)}
              className="px-2 py-1 sm:px-4 sm:py-2 rounded-full text-white transition-all hover:scale-105 text-xs sm:text-sm"
              style={{
                background: 'linear-gradient(135deg, #4ade80 0%, #059669 100%)',
                border: '1px solid #34d399'
              }}
            >
              À propos
            </button>
            
            <div className={`flex items-center space-x-1 sm:space-x-2 px-2 py-1 sm:px-3 sm:py-2 rounded-full text-xs ${
              connectionStatus === 'connected' 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
              } animate-pulse`}></div>
              <span className="hidden sm:inline text-xs">
                {connectionStatus === 'connected' ? 'OpenAI OK' : 'Erreur'}
              </span>
            </div>
            
            <button
              onClick={() => setSpeechEnabled(!speechEnabled)}
              className={`p-2 sm:p-4 rounded-full transition-all ${
                speechEnabled 
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                  : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
              }`}
              title={speechEnabled ? 'Audio activé' : 'Audio désactivé'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="sm:w-5 sm:h-5">
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
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Indication de configuration */}
        <div className={`border rounded-xl p-4 mb-6 ${
          OPENAI_API_KEY 
            ? 'bg-green-900/20 border-green-500/30' 
            : 'bg-red-900/20 border-red-500/30'
        }`}>
          <h3 className={`font-semibold mb-2 text-sm sm:text-base ${
            OPENAI_API_KEY ? 'text-green-300' : 'text-red-300'
          }`}>
            {OPENAI_API_KEY ? '✅ Configuration OK' : '❌ Configuration requise'}
          </h3>
          <p className={`text-xs sm:text-sm ${
            OPENAI_API_KEY ? 'text-green-200' : 'text-red-200'
          }`}>
            {OPENAI_API_KEY 
              ? 'Application prête. Optimisée pour iPhone et iPad Safari.'
              : 'Configurez la variable REACT_APP_OPENAI_API_KEY dans Vercel.'
            }
          </p>
          {!speechRecognitionSupported && (
            <p className="text-yellow-200 text-xs mt-2">
              ⚠️ La reconnaissance vocale n'est pas supportée sur cet appareil.
            </p>
          )}
        </div>

        {!conversationActive ? (
          <div className="text-center py-6 sm:py-12">
            <div className="mb-6 sm:mb-12">
              <div className="w-20 h-20 sm:w-32 sm:h-32 mx-auto mb-4 sm:mb-8 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full flex items-center justify-center relative">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-white sm:w-16 sm:h-16">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill="currentColor"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="2"/>
                  <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
                  <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <div className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping"></div>
              </div>
              
              <h2 className="text-xl sm:text-3xl lg:text-4xl font-bold mb-4">PPCare Voice</h2>
              <p className="text-sm sm:text-xl text-blue-200 mb-4 sm:mb-8 max-w-3xl mx-auto leading-relaxed px-4">
                Assistant vocal PPC optimisé pour iPhone et iPad Safari.
              </p>
              
              <button
                onClick={startConversation}
                disabled={!OPENAI_API_KEY}
                className={`px-4 sm:px-8 py-3 sm:py-5 rounded-full text-sm sm:text-xl font-medium transition-all transform shadow-lg ${
                  OPENAI_API_KEY 
                    ? 'hover:scale-105 border-green-400' 
                    : 'opacity-50 cursor-not-allowed bg-gray-500'
                }`}
                style={{
                  background: OPENAI_API_KEY ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : undefined,
                  border: OPENAI_API_KEY ? '2px solid #34d399' : undefined
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="inline mr-2 sm:mr-3 sm:w-6 sm:h-6">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill="currentColor"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="2"/>
                  <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
                  <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2"/>
                </svg>
                {OPENAI_API_KEY ? 'Commencer' : 'Config requise'}
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-12">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  className={`${action.color} p-4 sm:p-8 rounded-2xl cursor-pointer hover:scale-105 transition-transform shadow-lg text-left ${
                    !OPENAI_API_KEY ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  onClick={() => OPENAI_API_KEY && handleQuickAction(action.question)}
                  disabled={!OPENAI_API_KEY}
                  style={{ minHeight: '80px' }}
                >
                  <p className="text-white text-xs sm:text-base font-medium text-center">{action.text}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 text-center">
              <div className="bg-white/5 backdrop-blur rounded-xl p-3 sm:p-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-blue-400 mx-auto mb-2 sm:w-8 sm:h-8">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2"/>
                  <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2"/>
                  <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <p className="text-sm sm:text-xl font-bold text-white">Frontend</p>
                <p className="text-blue-200 text-xs sm:text-sm">Pas de serveur</p>
              </div>
              <div className="bg-white/5 backdrop-blur rounded-xl p-3 sm:p-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-green-400 mx-auto mb-2 sm:w-8 sm:h-8">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2"/>
                  <path d="M17 13v6l-5 2-5-2v-6" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <p className="text-sm sm:text-xl font-bold text-white">iOS Ready</p>
                <p className="text-blue-200 text-xs sm:text-sm">Safari optimisé</p>
              </div>
              <div className="bg-white/5 backdrop-blur rounded-xl p-3 sm:p-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-yellow-400 mx-auto mb-2 sm:w-8 sm:h-8">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>
                </svg>
                <p className="text-sm sm:text-xl font-bold text-white">Sécurisé</p>
                <p className="text-blue-200 text-xs sm:text-sm">API protégée</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 sm:py-6">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 min-h-[250px] max-h-[350px] overflow-y-auto">
              {conversationHistory.length === 0 ? (
                <div className="text-center text-blue-200 py-8">
                  <p>Conversation initialisée...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conversationHistory.map((msg, index) => (
                    <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 sm:p-4 rounded-2xl ${
                        msg.type === 'user' 
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white' 
                          : 'bg-white/10 text-white backdrop-blur'
                      }`}>
                        <div className="flex items-center mb-2">
                          <span className="text-xs opacity-70">
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <p className="leading-relaxed text-sm sm:text-base">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {transcript && (
              <div className="bg-blue-500/20 backdrop-blur rounded-xl p-4 mb-4 border border-blue-400/30">
                <p className="text-blue-400 text-sm font-medium mb-2">Je vous écoute...</p>
                <p className="text-white text-sm sm:text-base leading-relaxed">{transcript}</p>
              </div>
            )}

            <div className="text-center">
              {isProcessing ? (
                <div className="py-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full flex items-center justify-center">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                  <p className="text-blue-200 text-sm sm:text-base">L'assistant réfléchit...</p>
                </div>
              ) : (
                <div className="py-4">
                  <button
                    onClick={toggleListening}
                    disabled={!OPENAI_API_KEY || !speechRecognitionSupported}
                    className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full transition-all transform shadow-2xl ${
                      !OPENAI_API_KEY || !speechRecognitionSupported
                        ? 'bg-gray-500 opacity-50 cursor-not-allowed'
                        : isListening 
                          ? 'bg-red-500 hover:bg-red-600 animate-pulse scale-110' 
                          : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:scale-105'
                    }`}
                  >
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-white mx-auto sm:w-14 sm:h-14">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill="currentColor"/>
                      <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="2"/>
                      <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
                      <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </button>
                  
                  <div className="mt-4">
                    <p className="text-sm sm:text-lg text-blue-200 font-medium">
                      {!OPENAI_API_KEY 
                        ? 'Configuration requise'
                        : !speechRecognitionSupported
                          ? 'Reconnaissance vocale non supportée'
                          : isListening 
                            ? 'Je vous écoute...' 
                            : 'Touchez pour parler'
                      }
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => {
                    if (isListening) stopListening();
                    setTranscript('');
                    speechSynthesis.cancel();
                  }}
                  className="px-4 py-2 sm:px-6 sm:py-3 rounded-full text-white transition-colors text-sm sm:text-base"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: '1px solid #34d399'
                  }}
                >
                  {isListening ? 'Arrêter' : 'Effacer & Stop audio'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-blue-300 text-xs py-4 border-t border-white/10">
          <p>PPCare Voice - iOS/iPad Optimisé • OpenAI Sécurisé • Synthèse native</p>
          <p>Développé par Dom Tech & Services</p>
        </div>
      </div>
    </div>
  );
};

export default App;

