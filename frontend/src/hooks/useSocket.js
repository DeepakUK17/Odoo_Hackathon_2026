import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socket = null;

export const useSocket = (user, onNotification) => {
  const initialized = useRef(false);

  useEffect(() => {
    if (!user || initialized.current) return;
    initialized.current = true;

    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      transports: ['websocket'],  // Match server - skip polling, direct websocket
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 5000,
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected');
      socket.emit('join:org', user.org_id);
      socket.emit('join:user', user.id);
    });

    socket.on('notification:new', (notification) => {
      onNotification?.(notification);
    });

    socket.on('disconnect', () => console.log('🔌 Socket disconnected'));

    return () => {
      socket?.disconnect();
      socket = null;
      initialized.current = false;
    };
  }, [user]);

  return socket;
};

export const getSocket = () => socket;
