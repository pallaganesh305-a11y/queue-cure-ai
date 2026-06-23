import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import { 
  FiMessageSquare, FiX, FiSend, FiCpu, 
  FiMic, FiMicOff 
} from 'react-icons/fi';

const AiAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: "Hello! I'm your **AI Clinic Assistant**. Ask me anything, or click the **microphone button** to use voice commands! For example:\n- *\"Call next patient\"*\n- *\"Who is next?\"*\n- *\"Show today's analytics\"*"
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [micState, setMicState] = useState('idle'); // 'idle', 'listening', 'thinking', 'speaking', 'error'
  const [pendingAction, setPendingAction] = useState(null); // Stores confirmation action loops
  
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const { queue, stats, refreshData } = useSocket();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, micState]);

  // helper to add bot replies to feed
  const addBotMessage = (text) => {
    setMessages(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        sender: 'assistant',
        text: text
      }
    ]);
  };

  // Web Speech API: Text-to-Speech voice synthesis
  const speakText = (text, startListenAfter = false) => {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    setMicState('speaking');
    
    // Strip markdown bold tags for speech synthesis readability
    const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    
    utterance.onend = () => {
      if (startListenAfter) {
        // Triggers confirmation listen loop after speech finishes
        setTimeout(() => {
          startVoiceRecognition();
        }, 150);
      } else {
        setMicState('idle');
      }
    };
    
    utterance.onerror = () => {
      setMicState('idle');
    };
    
    window.speechSynthesis.speak(utterance);
  };

  // Web Speech API: Speech Recognition
  const startVoiceRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Web Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    // Stop speaking when listening starts
    window.speechSynthesis.cancel();

    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setMicState('listening');
    };

    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          sender: 'user',
          text: `🗣️ "${transcript}"`
        }
      ]);
      parseVoiceCommand(transcript);
    };

    rec.onerror = (e) => {
      console.error('Speech recognition error:', e.error);
      setMicState('error');
      const errReply = "Sorry, I didn't catch that. Please click the mic and try again.";
      addBotMessage(errReply);
      setTimeout(() => setMicState('idle'), 1500);
    };

    rec.onend = () => {
      setMicState(prev => (prev === 'listening' ? 'idle' : prev));
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setMicState('idle');
    }
  };

  const toggleVoiceMode = () => {
    if (micState === 'listening') {
      stopVoiceRecognition();
    } else {
      startVoiceRecognition();
    }
  };

  // Voice Command Routing & Execution Engine
  const parseVoiceCommand = async (commandText) => {
    const text = commandText.toLowerCase().trim();
    setMicState('thinking');

    // 1. Handle Active Confirmations (Safety triggers for destructive actions)
    if (pendingAction) {
      if (text.includes('yes') || text.includes('confirm') || text.includes('sure') || text.includes('okay')) {
        const actionType = pendingAction.type;
        try {
          if (actionType === 'reset_queue' || actionType === 'delete_history') {
            await axios.post('/api/queue/reset');
            const reply = "Wiped! Today's queue and histories have been successfully reset.";
            addBotMessage(reply);
            speakText(reply);
          } else if (actionType === 'remove_patient') {
            await axios.delete(`/api/queue/${pendingAction.id}`);
            const reply = `Successfully removed patient **${pendingAction.name}** from the active waiting timeline.`;
            addBotMessage(reply);
            speakText(reply);
          }
          refreshData();
        } catch {
          const reply = "Database mutation failed. Please verify API endpoints.";
          addBotMessage(reply);
          speakText(reply);
        } finally {
          setPendingAction(null);
        }
      } else if (text.includes('no') || text.includes('cancel') || text.includes('stop')) {
        const reply = "Operation cancelled.";
        addBotMessage(reply);
        speakText(reply);
        setPendingAction(null);
      } else {
        const reply = "I didn't receive a clear yes or no confirmation. Operation cancelled.";
        addBotMessage(reply);
        speakText(reply);
        setPendingAction(null);
      }
      return;
    }

    // 2. Standard Voice Command Routing
    // "Call next patient"
    if (text.includes('call next')) {
      try {
        const res = await axios.post('/api/queue/call-next');
        if (res.data.token) {
          const reply = `Calling Token **${res.data.token}**, Patient **${res.data.patient.name}**, to **${stats.current_room}**.`;
          addBotMessage(reply);
          speakText(reply);
        } else {
          const reply = "There are no patients waiting in the queue right now.";
          addBotMessage(reply);
          speakText(reply);
        }
        refreshData();
      } catch {
        handleApiError();
      }
    }
    // "Who is next?"
    else if (text.includes('who is next') || text.includes("who's next")) {
      const waiting = queue.filter(q => q.status === 'waiting');
      if (waiting.length > 0) {
        const nextInLine = waiting[0];
        const reply = `The next patient in line is **${nextInLine.patient.name}** (Token: **${nextInLine.token}**, Priority: **${nextInLine.priority}**).`;
        addBotMessage(reply);
        speakText(reply);
      } else {
        const reply = "There are no patients waiting in today's queue.";
        addBotMessage(reply);
        speakText(reply);
      }
    }
    // "How many patients are waiting?"
    else if (text.includes('how many patients') || text.includes('how many waiting') || text.includes('waiting count')) {
      const count = stats.waiting_count;
      const reply = count === 0 
        ? "No patients are waiting in today's list." 
        : `There are currently **${count} patients waiting** in queue.`;
      addBotMessage(reply);
      speakText(reply);
    }
    // "Current token"
    else if (text.includes('current token') || text.includes('now serving') || text.includes('current patient')) {
      if (stats.current_token !== 'N/A') {
        const reply = `The active token is **${stats.current_token}**, Patient: **${stats.current_patient}**.`;
        addBotMessage(reply);
        speakText(reply);
      } else {
        const reply = "The consultation room is currently empty. No active token.";
        addBotMessage(reply);
        speakText(reply);
      }
    }
    // "Average consultation time"
    else if (text.includes('average consultation') || text.includes('average wait')) {
      const reply = `Today's average consultation duration is **${stats.average_consultation} minutes**, calculated dynamically.`;
      addBotMessage(reply);
      speakText(reply);
    }
    // "Queue health"
    else if (text.includes('queue health') || text.includes('health of queue')) {
      const reply = `Queue Health Status: **${stats.queue_health.status}**. recommendation: ${stats.queue_health.recommendation}`;
      addBotMessage(reply);
      speakText(reply);
    }
    // "Doctor status"
    else if (text.includes('doctor status') || text.includes('availability of doctor')) {
      const statusText = stats.doctor_status.replace('_', ' ').toUpperCase();
      const reply = `Doctor **${stats.doctor_name}** is currently **${statusText}** in **${stats.current_room}**.`;
      addBotMessage(reply);
      speakText(reply);
    }
    // "Skip current patient"
    else if (text.includes('skip current')) {
      const consulting = queue.find(q => q.status === 'consulting');
      if (consulting) {
        try {
          await axios.post(`/api/queue/skip/${consulting.id}`);
          const reply = `Skipped Token **${consulting.token}** (${consulting.patient.name}).`;
          addBotMessage(reply);
          speakText(reply);
          refreshData();
        } catch {
          handleApiError();
        }
      } else {
        const reply = "No active patient in consultation room to skip.";
        addBotMessage(reply);
        speakText(reply);
      }
    }
    // "Search patient <name>"
    else if (text.startsWith('search patient ')) {
      const queryName = text.replace('search patient ', '').trim();
      const match = queue.find(q => q.patient.name.toLowerCase().includes(queryName));
      if (match) {
        let statusStr = match.status === 'waiting' ? 'waiting in line' : match.status === 'consulting' ? 'currently inside' : 'skipped';
        const reply = `Patient **${match.patient.name}** found. Token: **${match.token}** (${statusStr}). Estimated wait: **${match.estimated_wait} mins**.`;
        addBotMessage(reply);
        speakText(reply);
      } else {
        const reply = `No active patient matching **${queryName}** was found.`;
        addBotMessage(reply);
        speakText(reply);
      }
    }
    // "Show today's analytics"
    else if (text.includes('show analytics') || text.includes('show today\'s analytics') || text.includes('analytics dashboard')) {
      window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'analytics' }));
      const reply = "Opening today's analytics board.";
      addBotMessage(reply);
      speakText(reply);
    }
    // "Show active queue" (Bonus command to toggle back)
    else if (text.includes('show queue') || text.includes('show active queue') || text.includes('go to queue')) {
      window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'queue' }));
      const reply = "Navigating to active queue table.";
      addBotMessage(reply);
      speakText(reply);
    }
    // "Reset queue" (Destructive, requires confirmation)
    else if (text.includes('reset queue')) {
      setPendingAction({ type: 'reset_queue' });
      const reply = "Are you sure you want to reset today's queue? This will wipe all enqueued patients. Please say **yes** or **no**.";
      addBotMessage(reply);
      speakText(reply, true); // True tells speechSynthesis to trigger mic listen onend
    }
    // "Remove patient <name>" (Destructive, requires confirmation)
    else if (text.startsWith('remove patient ')) {
      const removeName = text.replace('remove patient ', '').trim();
      const match = queue.find(q => q.patient.name.toLowerCase().includes(removeName));
      if (match) {
        setPendingAction({ type: 'remove_patient', id: match.id, name: match.patient.name });
        const reply = `Are you sure you want to remove patient **${match.patient.name}** (Token: **${match.token}**) from the queue? Please say **yes** or **no**.`;
        addBotMessage(reply);
        speakText(reply, true);
      } else {
        const reply = `Could not find patient **${removeName}** to remove.`;
        addBotMessage(reply);
        speakText(reply);
      }
    }
    // "Delete history" (Destructive, requires confirmation)
    else if (text.includes('delete history') || text.includes('clear history')) {
      setPendingAction({ type: 'delete_history' });
      const reply = "Are you sure you want to delete today's consultation history? Please say **yes** or **no**.";
      addBotMessage(reply);
      speakText(reply, true);
    }
    // Command not matching
    else {
      const reply = "Spoken command not recognized. Try saying: *\"Call next patient\"*, *\"Who is next?\"*, or *\"Show today's analytics\"*.";
      addBotMessage(reply);
      speakText(reply);
    }
  };

  const handleApiError = () => {
    const errorMsg = "API communication failure. Check backend connection.";
    addBotMessage(errorMsg);
    speakText(errorMsg);
  };

  // Text chat submission handler
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputVal.trim() || isLoading) return;

    const userMessageText = inputVal;
    setInputVal('');
    
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: userMessageText }]);
    setIsLoading(true);

    try {
      const res = await axios.post('/api/ai/chat', { message: userMessageText });
      addBotMessage(res.data.response);
    } catch (err) {
      console.error(err);
      addBotMessage("I'm having trouble fetching queue statistics at the moment.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuery = (text) => {
    setInputVal(text);
  };

  const formatText = (text) => {
    return text.split('\n').map((line, i) => {
      const boldRegex = /\*\*(.*?)\*\*/g;
      let match;
      const segments = [];
      let lastIndex = 0;

      while ((match = boldRegex.exec(line)) !== null) {
        segments.push(line.substring(lastIndex, match.index));
        segments.push(<strong key={match.index} className="font-bold text-slate-900 dark:text-white">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      segments.push(line.substring(lastIndex));

      return (
        <p key={i} className={line.trim().startsWith('-') ? 'pl-4 -indent-4 mb-1' : 'mb-2'}>
          {segments.length > 1 ? segments : line}
        </p>
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* Floating Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="w-[360px] h-[500px] mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden glass-card"
          >
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white relative">
                  <FiCpu className="w-4 h-4" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    AI Assistant
                    {micState !== 'idle' && (
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        micState === 'listening' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-450 animate-pulse' :
                        micState === 'thinking' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-brand-400 animate-pulse' :
                        micState === 'speaking' ? 'bg-emerald-105 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-450' :
                        'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-450'
                      }`}>
                        {micState}
                      </span>
                    )}
                  </h4>
                  <span className="text-xxs text-slate-400 font-medium block">Queue Cure Intelligence</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Body */}
            <div className="flex-grow p-4 overflow-y-auto space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-medium ${
                      msg.sender === 'user'
                        ? 'bg-brand-600 text-white rounded-tr-none'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-350 rounded-tl-none border border-slate-200/50 dark:border-slate-700/50'
                    }`}
                  >
                    {msg.sender === 'assistant' ? formatText(msg.text) : <p>{msg.text}</p>}
                  </div>
                </div>
              ))}
              
              {/* Thinking loader */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 text-slate-500 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-150"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-300"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Queries */}
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800/80 flex gap-2 overflow-x-auto whitespace-nowrap bg-slate-50/20 dark:bg-slate-950/5 scrollbar-thin">
              <button
                onClick={() => handleQuickQuery("Who has waited the longest?")}
                className="px-3 py-1 rounded-full border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 text-[10px] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-all"
              >
                Longest Wait
              </button>
              <button
                onClick={() => handleQuickQuery("Why is wait time increasing?")}
                className="px-3 py-1 rounded-full border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 text-[10px] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-all"
              >
                Wait Reasons
              </button>
              <button
                onClick={() => handleQuickQuery("What is doctor status?")}
                className="px-3 py-1 rounded-full border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 text-[10px] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-all"
              >
                Doctor Status
              </button>
            </div>

            {/* Chat Input / Voice mic button controls */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 items-center">
              
              {/* Mic Toggle Button */}
              <button
                type="button"
                onClick={toggleVoiceMode}
                className={`p-2 rounded-xl border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                  micState === 'listening'
                    ? 'bg-rose-500 text-white border-rose-500 glowing-pulse'
                    : micState === 'speaking'
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : micState === 'thinking'
                        ? 'bg-blue-500 text-white border-blue-500 animate-pulse'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-55 dark:hover:bg-slate-800'
                }`}
                title="Voice Queue Assistant"
              >
                {micState === 'listening' ? (
                  <FiMicOff className="w-4 h-4" />
                ) : (
                  <FiMic className="w-4 h-4" />
                )}
              </button>

              <input
                type="text"
                placeholder={micState === 'listening' ? "Listening..." : "Ask assistant..."}
                disabled={isLoading || micState === 'listening'}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="flex-grow px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-800 dark:text-white"
              />
              
              <button
                type="submit"
                disabled={isLoading || !inputVal.trim() || micState === 'listening'}
                className="p-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white disabled:bg-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 transition-colors flex items-center justify-center shrink-0"
              >
                <FiSend className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-550 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 glowing-pulse cursor-pointer border border-brand-500"
      >
        <FiMessageSquare className="w-6 h-6" />
      </button>
    </div>
  );
};

export default AiAssistant;
