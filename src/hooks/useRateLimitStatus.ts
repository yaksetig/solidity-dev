import { useState, useEffect } from 'react';
import { APIServices } from '@/services/apiServices';

interface RateLimitStatus {
  queueLength: number;
  isProcessing: boolean;
  estimatedWaitTime: number;
  requestCount: number;
  timeUntilNextWindow: number;
}

export const useRateLimitStatus = (apiServices: APIServices | null) => {
  const [status, setStatus] = useState<RateLimitStatus>({
    queueLength: 0,
    isProcessing: false,
    estimatedWaitTime: 0,
    requestCount: 0,
    timeUntilNextWindow: 0
  });

  useEffect(() => {
    if (!apiServices) return;

    const updateStatus = () => {
      // Access the rate limiter status (we'll need to expose this method)
      try {
        const queueStatus = (apiServices as any).rateLimiter?.getQueueStatus?.() || {};
        const estimatedWait = (apiServices as any).rateLimiter?.getEstimatedWaitTime?.() || 0;
        
        setStatus({
          queueLength: queueStatus.queueLength || 0,
          isProcessing: queueStatus.isProcessing || false,
          estimatedWaitTime: estimatedWait,
          requestCount: queueStatus.requestCount || 0,
          timeUntilNextWindow: queueStatus.timeUntilNextWindow || 0
        });
      } catch (error) {
        console.warn('Could not get rate limit status:', error);
      }
    };

    // Update status every second when processing
    const interval = setInterval(updateStatus, 1000);
    updateStatus(); // Initial update

    return () => clearInterval(interval);
  }, [apiServices]);

  const formatTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return {
    ...status,
    formatTime,
    hasQueue: status.queueLength > 0,
    isWaiting: status.isProcessing || status.queueLength > 0
  };
};