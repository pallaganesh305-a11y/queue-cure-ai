import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({
    waiting_count: 0,
    completed_count: 0,
    skipped_count: 0,
    current_token: 'N/A',
    current_patient: 'N/A',
    average_consultation: 10,
    total_wait_estimate: 0,
    doctor_name: 'Dr. Alex Mercer',
    doctor_status: 'active',
    doctor_speed: 'normal',
    current_room: 'Consultation Room 1',
    queue_health: { status: 'Healthy', color: 'emerald', score: 100, recommendation: '' }
  });
  const [notifications, setNotifications] = useState([]);

  // Fetch fallback data via HTTP REST
  const fetchQueueData = useCallback(async () => {
    try {
      const queueRes = await axios.get('/api/queue');
      const settingsRes = await axios.get('/api/settings');
      const notifsRes = await axios.get('/api/notifications');
      
      setQueue(queueRes.data);
      
      // Compute stats locally if socket server didn't supply them
      const waiting = queueRes.data.filter(q => q.status === 'waiting');
      const consulting = queueRes.data.find(q => q.status === 'consulting');
      
      setStats(prev => ({
        ...prev,
        waiting_count: waiting.length,
        current_token: consulting ? consulting.token : 'N/A',
        current_patient: consulting ? consulting.patient.name : 'N/A',
        doctor_name: settingsRes.data.doctor_name || prev.doctor_name,
        doctor_status: settingsRes.data.doctor_status || prev.doctor_status,
        doctor_speed: settingsRes.data.doctor_speed || prev.doctor_speed,
        current_room: settingsRes.data.current_room || prev.current_room,
      }));
      setNotifications(notifsRes.data);
    } catch (err) {
      console.error('Failed to fetch fallback queue data:', err);
    }
  }, []);

  useEffect(() => {
    // Connect to Vite proxy (which goes to backend/5000)
    const socketInstance = io(window.location.origin, {
      reconnectionAttempts: 20,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling']
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      console.log('Socket connected successfully');
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    });

    socketInstance.on('reconnect_attempt', () => {
      setIsReconnecting(true);
    });

    socketInstance.on('reconnect_failed', () => {
      setIsReconnecting(false);
      console.warn('Socket reconnection failed');
    });

    socketInstance.on('queue_updated', (data) => {
      setQueue(data.queue);
      setStats(data.stats);
      setNotifications(data.notifications);
    });

    // Initial load
    fetchQueueData();

    return () => {
      socketInstance.disconnect();
    };
  }, [fetchQueueData]);

  // Set up backup HTTP polling if socket remains disconnected
  useEffect(() => {
    let intervalId;
    if (!isConnected) {
      // Poll every 5 seconds when socket is offline
      intervalId = setInterval(() => {
        fetchQueueData();
      }, 5000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isConnected, fetchQueueData]);

  const addLocalNotification = useCallback((message, type = 'info') => {
    const newNotif = {
      id: Date.now() + Math.random(),
      message,
      type,
      is_read: false,
      created_at: new Date().toISOString()
    };
    setNotifications(prev => [newNotif, ...prev]);
  }, []);

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      isReconnecting,
      queue,
      stats,
      notifications,
      refreshData: fetchQueueData,
      addLocalNotification
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
