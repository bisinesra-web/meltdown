import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';

const useSocket = (url: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [url, socket]);

  return { socket, connected, setSocket, setConnected };
};

export default useSocket;
