import { useState, useEffect } from 'react';

type TimersMap = Record<string, number>;

export function useLocalTimers() {
  const [timers, setTimers] = useState<TimersMap>(() => {
    try {
      const stored = localStorage.getItem('kitchen_timers');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('kitchen_timers', JSON.stringify(timers));
  }, [timers]);

  const startTimer = (orderId: string, serverStartedAt?: string | null) => {
    setTimers(prev => {
      if (prev[orderId]) return prev; // Already started
      return {
        ...prev,
        [orderId]: serverStartedAt ? new Date(serverStartedAt).getTime() : Date.now()
      };
    });
  };

  const getStartTime = (orderId: string) => {
    return timers[orderId] || null;
  };

  const removeTimer = (orderId: string) => {
    setTimers(prev => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  };

  return { startTimer, getStartTime, removeTimer };
}

export function useElapsedTime(startTime: number | null) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) {
      setElapsed(0);
      return;
    }

    const update = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return elapsed; // in seconds
}
