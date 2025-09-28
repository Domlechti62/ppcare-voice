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
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isListeningRef = useRef(false);

  const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isIPad = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // FONCTION DE DIAGNOSTIC : Analyser toutes les voix disponibles
  const analyzeVoices = () => {
    const voices = speechSynthesis.getVoices();
    console.log('=== DIAGNOSTIC COMPLET DES VOIX ===');
    console.log('Nombre total de voix:', voices.length);
    
    const voicesData = voices.map((voice, index) => {
      const analysis = {
        index,
        name: voice.name,
        lang: voice.lang,
        localService: voice.localService,
        default: voice.default,
        voiceURI: voice.voiceURI,
        isFrench: voice.lang.includes('fr'),
        quality: 'unknown'
      };
      
      // Analyse de la qualité basée sur le nom et les métadonnées
      if (voice.name.toLowerCase().includes('premium') || 
          voice.name.toLowerCase().includes('neural') ||
          voice.name.toLowerCase().includes('wavenet')) {
        analysis.quality = 'premium';
      } else if (voice.localService) {
        analysis.quality = 'local-good';
      } else {
        analysis.quality = 'standard';
      }
      
      console.log(`Voix ${index}:`, analysis);
      return analysis;
    });
    
    // Filtrer et classer les voix françaises
    const frenchVoices = voicesData.filter(v => v.isFrench);
    console.log('Voix françaises trouvées:', frenchVoices.length);
    
    frenchVoices.forEach(voice => {
      console.log(`FR: ${voice.name} (${voice.lang}) - Qualité: ${voice.quality} - Local: ${voice.localService}`);
    });
    
    setAvailableVoices(voicesData);
    return voicesData;
  };

  // FONCTION OPTIMISÉE : Sélection intelligente de voix
  const selectBestVoice = () => {
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) return null;
    
    console.log('=== SÉLECTION INTELLIGENTE DE VOIX ===');
    
    // 1. Hiérarchie de priorité pour les voix françaises
    const frenchPriority = [
      // Voix iOS premium
      'Amélie (Enhanced)', 'Amélie', 'Thomas (Enhanced)', 'Thomas', 'Audrey (Enhanced)', 'Audrey',
      // Voix macOS
      'Virginie', 'Céline',
      // Voix Google
      'Google français', 'Google Français',
      // Voix Microsoft
      'Microsoft Hortense', 'Microsoft Julie',
      // Autres voix françaises
      'French Female', 'French Male'
    ];
    
    // 2. Chercher dans l'ordre de priorité
    for (const voiceName of frenchPriority) {
      const voice = voices.find(v => 
        v.name.includes(voiceName) || 
        v.name.toLowerCase().includes(voiceName.toLowerCase())
      );
      
      if (voice) {
        console.log('Voix premium trouvée:', voice.name);
        setSelectedVoice(voice);
        return voice;
      }
    }
    
    // 3. Chercher toute voix française locale
    const localFrenchVoice = voices.find(v => 
      v.lang.startsWith('fr') && v.localService
    );
    
    if (localFrenchVoice) {
      console.log('Voix française locale trouvée:', localFrenchVoice.name);
      setSelectedVoice(localFrenchVoice);
      return localFrenchVoice;
    }
    
    // 4. Chercher toute voix française
    const anyFrenchVoice = voices.find(v => v.lang.startsWith('fr'));
    
    if (anyFrenchVoice) {
      console.log('Voix française standard trouvée:', anyFrenchVoice.name);
      setSelectedVoice(anyFrenchVoice);
      return anyFrenchVoice;
    }
    
    // 5. Fallback vers voix anglaise de qualité
    const qualityEnglishVoices = ['Samantha', 'Alex', 'Karen', 'Google UK English Female'];
    
    for (const voiceName of qualityEnglishVoices) {
      const voice = voices.find(v => v.name.includes(voiceName));
      if (voice) {
        console.log('Fallback vers voix anglaise de qualité:', voice.name);
        setSelectedVoice(voice);
        return voice;
      }
    }
    
    // 6. Dernière option : voix par défaut
    console.log('Utilisation voix par défaut');
    const defaultVoice = voices[0];
    setSelectedVoice(defaultVoice);
    return defaultVoice;
  };

  // FONCTION DE TEST : Tester une voix spécifique
  const testVoice = (voice, testText = "Bonjour, je teste cette voix française") => {
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(testText);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onstart = () => console.log(`Test de ${voice.name} démarré`);
    utterance.onend = () => console.log(`Test de ${voice.name} terminé`);
    utterance.onerror = (e) => console.error(`Erreur test ${voice.name}:`, e.error);
    
    speechSynthesis.speak(utterance);
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

  const speakText = (text) => {
    if (!speechEnabled) return;
    
    console.log('Lecture avec voix sélectionnée:', selectedVoice?.name || 'aucune');
    
    try {
      speechSynthesis.cancel();
      
      if (isIOS && !audioInitialized) {
        console.warn('Audio non initialisé sur iOS');
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang = 'fr-FR';
      }
      
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => console.log('Synthèse démarrée avec:', selectedVoice?.name || 'voix par défaut');
      utterance.onend = () => console.log('Synthèse terminée');
      utterance.onerror = (e) => console.error('Erreur synthèse:', e.error);
      
      speechSynthesis.speak(utterance);
      
    } catch (error) {
      console.error('Erreur synthèse vocale:', error);
    }
  };

  const initVoices = () => {
    const voicesData = analyzeVoices();
    const bestVoice = selectBestVoice();
    
    const frenchVoices = voicesData.filter(v => v.isFrench);
    setVoiceInfo(frenchVoices.length > 0 ? 
      `${frenchVoices.length} voix FR • ${bestVoice?.name || 'Par défaut'}` : 
      'Aucune voix française'
    );
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
      const errorMessage = "Clé API OpenAI manquante.";
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

      if (speechEnabled) {
        setTimeout(() => speakText(aiResponse), 300);
      }

    } catch (error) {
      console.error('Erreur complète:', error);
      
      let errorMessage = "Désolé, je n'ai pas pu traiter votre demande.";
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

  const handleQuickAction = async (question) => {
    initializeAudioContext();
    
    if (!conversationActive) {
      await startConversation();
      setTimeout(() => {
        handleSpeechSubmit(question);
      }, 1500);
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
      color: "bg-gradient-special-red",
      question: "J'ai des problèmes de fuite avec mon masque PPC"
    },
    { 
      text: "Machine bruyante", 
      color: "bg-gradient-special-orange",
      question: "Ma machine PPC fait du bruit anormal"
    },
    { 
      text: "Entretien & nettoyage", 
      color: "bg-gradient-special-blue",
      question: "Comment bien nettoyer ma machine PPC ?"
    },
    { 
      text: "Confort sommeil", 
      color: "bg-gradient-special-purple",
      question: "Comment améliorer mon confort avec la PPC ?"
    },
  ];

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
              <h1 className="text-2xl font-bold">PPCare Voice - Diagnostic</h1>
              <p className="text-green-400 text-xs">
                {isIOS ? (isIPad ? 'iPad' : 'iPhone') : 'PC'} • {voiceInfo}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowVoicePanel(!showVoicePanel)}
              className="px-3 py-2 rounded-full text-white transition-all hover:scale-105 text-xs"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                border: '1px solid #a78bfa'
              }}
            >
              Voix ({availableVoices.filter(v => v.isFrench).length})
            </button>
            
            <button
              onClick={() => {
                initializeAudioContext();
                if (selectedVoice) {
                  testVoice(selectedVoice);
                } else {
                  speakText("Test de la voix par défaut");
                }
              }}
              className="px-3 py-2 rounded-full text-white transition-all hover:scale-105 text-xs"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: '1px solid #fbbf24'
              }}
            >
              Test Voix
            </button>
            
            <button
              onClick={() => setSpeechEnabled(!speechEnabled)}
              className={`p-4 rounded-full transition-all ${
                speechEnabled 
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                  : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
              }`}
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
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6">
        {/* Panel de diagnostic des voix */}
        {showVoicePanel && (
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 mb-6 border border-white/20">
            <h3 className="text-xl font-bold mb-4 text-blue-400">Diagnostic des Voix Disponibles</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-blue-200 mb-2">Voix actuellement sélectionnée :</p>
                <p className="text-green-400 font-medium">
                  {selectedVoice ? `${selectedVoice.name} (${selectedVoice.lang})` : 'Aucune voix sélectionnée'}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-200 mb-2">Plateforme détectée :</p>
                <p className="text-yellow-400 font-medium">
                  {isIOS ? (isIPad ? 'iPad Safari' : 'iPhone Safari') : 'Desktop'}
                </p>
              </div>
            </div>
            
            <div className="space-y-3 max-h-60 overflow-y-auto">
              <h4 className="text-lg font-semibold text-green-400">Voix Françaises ({availableVoices.filter(v => v.isFrench).length})</h4>
              {availableVoices.filter(v => v.isFrench).map((voice, index) => (
                <div key={index} className="bg-white/5 p-3 rounded-lg border-l-4 border-green-400">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-white">{voice.name}</p>
                      <p className="text-xs text-blue-200">
                        {voice.lang} • {voice.localService ? 'Local' : 'Cloud'} • Qualité: {voice.quality}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          initializeAudioContext();
                          const voiceObj = speechSynthesis.getVoices()[voice.index];
                          testVoice(voiceObj);
                        }}
                        className="px-3 py-1 rounded text-xs bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        Tester
                      </button>
                      <button
                        onClick={() => {
                          const voiceObj = speechSynthesis.getVoices()[voice.index];
                          setSelectedVoice(voiceObj);
                        }}
                        className="px-3 py-1 rounded text-xs bg-green-500 hover:bg-green-600 text-white"
                      >
                        Sélectionner
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              <h4 className="text-lg font-semibold text-yellow-400">Autres Voix ({availableVoices.filter(v => !v.isFrench).length})</h4>
              {availableVoices.filter(v => !v.isFrench).slice(0, 10).map((voice, index) => (
                <div key={index} className="bg-white/5 p-3 rounded-lg border-l-4 border-gray-400">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-white">{voice.name}</p>
                      <p className="text-xs text-gray-300">
                        {voice.lang} • {voice.localService ? 'Local' : 'Cloud'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        initializeAudioContext();
                        const voiceObj = speechSynthesis.getVoices()[voice.index];
                        testVoice(voiceObj, "Hello, this is a voice test");
                      }}
                      className="px-3 py-1 rounded text-xs bg-gray-500 hover:bg-gray-600 text-white"
                    >
                      Tester
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-400/30">
              <p className="text-sm text-blue-200">
                <strong>Instructions :</strong> Testez les voix françaises une par une pour identifier celle avec la meilleure qualité. 
                Ouvrez la console (F12) pour voir les logs détaillés.
              </p>
            </div>
          </div>
        )}

        {/* Configuration */}
        <div className={`border rounded-xl p-4 mb-6 ${
          OPENAI_API_KEY 
            ? 'bg-green-900/20 border-green-500/30' 
            : 'bg-red-900/20 border-red-500/30'
        }`}>
          <h3 className={`font-semibold mb-2 ${
            OPENAI_API_KEY ? 'text-green-400' : 'text-red-400'
          }`}>
            {OPENAI_API_KEY ? '✅ Mode Diagnostic Actif' : '❌ Configuration requise'}
          </h3>
          <p className={`text-sm ${
            OPENAI_API_KEY ? 'text-green-200' : 'text-red-200'
          }`}>
            {OPENAI_API_KEY 
              ? `Voix détectées: ${availableVoices.length} • Françaises: ${availableVoices.filter(v => v.isFrench).length} • Audio: ${audioInitialized ? 'OK' : 'Cliquez pour activer'}`
              : 'Configurez REACT_APP_OPENAI_API_KEY'
            }
          </p>
        </div>

        {/* Interface simplifiée pour le test */}
        {!conversationActive ? (
          <div className="text-center py-12">
            <div className="mb-12">
              <div className="w-32 h-32 mx-auto mb-8 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center relative">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <div className="absolute inset-0 rounded-full bg-purple-400/30 animate-ping"></div>
              </div>
              
              <h2 className="text-4xl font-bold mb-4">Mode Diagnostic Voix</h2>
              <p className="text-xl text-blue-200 mb-8 max-w-2xl mx-auto leading-relaxed">
                Analysez et testez les voix disponibles sur votre appareil {isIOS ? 'iOS' : ''}.
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={() => setShowVoicePanel(true)}
                  className="px-8 py-4 rounded-full text-xl font-medium transition-all transform shadow-lg hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    border: '2px solid #a78bfa'
                  }}
                >
                  Ouvrir le Panel de Diagnostic
                </button>
                
                <button
                  onClick={startConversation}
                  disabled={!OPENAI_API_KEY}
                  className={`px-8 py-4 rounded-full text-xl font-medium transition-all transform shadow-lg ml-4 ${
                    OPENAI_API_KEY
                      ? 'hover:scale-105' 
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  style={{
                    background: OPENAI_API_KEY ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#6b7280',
                    border: OPENAI_API_KEY ? '2px solid #34d399' : '2px solid #9ca3af'
                  }}
                >
                  Tester en Conversation
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Interface de conversation simplifiée
          <div className="py-6">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 mb-6 min-h-[300px] max-h-[400px] overflow-y-auto">
              {conversationHistory.length === 0 ? (
                <div className="text-center text-blue-200 py-8">
                  <p>Test en cours...</p>
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
              <button
                onClick={toggleListening}
                disabled={!OPENAI_API_KEY}
                className={`w-24 h-24 rounded-full transition-all transform shadow-2xl ${
                  !OPENAI_API_KEY 
                    ? 'bg-gray-500 opacity-50 cursor-not-allowed'
                    : isListening 
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse scale-110' 
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:scale-105'
                }`}
              >
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-white mx-auto">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill="currentColor"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="2"/>
                  <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
                  <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
              
              <p className="text-lg text-blue-200 font-medium mt-4">
                Voix testée: {selectedVoice?.name || 'Par défaut'}
              </p>
            </div>
          </div>
        )}

        <div className="text-center text-blue-200 text-xs py-4 border-t border-white/10">
          <p>PPCare Voice - Mode Diagnostic • Ouvrez la console pour voir les logs détaillés</p>
          <p>Développé par Dom Tech & Services</p>
        </div>
      </div>
    </div>
  );
};

export default App;
