import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { FiVolume2, FiVolumeX } from 'react-icons/fi';

const SoundAnnouncer = () => {
  const { socket } = useSocket();
  const [isMuted, setIsMuted] = useState(true); // Browsers block autoplay, default to muted with user toggle

  const playChime = () => {
    // Standard synthetic chime using Web Audio API to avoid external file dependencies
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const playTone = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = audioCtx.currentTime;
      // Play a pleasant double-chime (ding-dong)
      playTone(523.25, now, 0.4); // C5
      playTone(659.25, now + 0.15, 0.6); // E5
    } catch (err) {
      console.error('Audio synthesis failed:', err);
    }
  };

  const speakAnnouncement = (text) => {
    if (!('speechSynthesis' in window)) return;
    
    // Stop any running speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // slightly slower for clarity
    utterance.pitch = 1.05;
    
    // Attempt to select a premium female voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      v => v.lang.includes('en') && (v.name.includes('Google') || v.name.includes('Natural'))
    );
    if (preferredVoice) utterance.voice = preferredVoice;

    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!socket) return;

    const handlePatientCalled = (data) => {
      if (isMuted) return;

      // 1. Play Chime
      playChime();

      // 2. Pronounce message (delay slightly after chime starts)
      setTimeout(() => {
        const text = `Token ${data.token.split('').join(' ')}, ${data.name}, please proceed to ${data.room}`;
        speakAnnouncement(text);
      }, 550);
    };

    socket.on('patient_called', handlePatientCalled);

    return () => {
      socket.off('patient_called', handlePatientCalled);
    };
  }, [socket, isMuted]);

  return (
    <button
      onClick={() => setIsMuted(!isMuted)}
      className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-sm font-medium transition-all duration-300 ${
        isMuted
          ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 dark:border-slate-700'
          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/60 glowing-pulse'
      }`}
      title={isMuted ? "Enable Voice Announcements" : "Mute Voice Announcements"}
    >
      {isMuted ? (
        <>
          <FiVolumeX className="w-4 h-4" />
          <span>Announcer Muted</span>
        </>
      ) : (
        <>
          <FiVolume2 className="w-4 h-4" />
          <span>Announcer Active</span>
        </>
      )}
    </button>
  );
};

export default SoundAnnouncer;
