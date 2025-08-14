interface RateLimitConfig {
  requestsPerMinute: number;
  retryDelaySeconds: number;
  maxRetries: number;
}

interface QueuedRequest {
  id: string;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retryCount: number;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private requestQueue: QueuedRequest[] = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private requestCount = 0;
  private windowStart = Date.now();

  constructor(config: RateLimitConfig = {
    requestsPerMinute: 100, // Claude Sonnet 4 has much higher limits
    retryDelaySeconds: 3, // Faster requests for paid tier
    maxRetries: 3
  }) {
    this.config = config;
  }

  async makeRequest<T>(requestFn: () => Promise<T>, requestId?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: requestId || Date.now().toString(),
        execute: requestFn,
        resolve,
        reject,
        retryCount: 0
      };

      this.requestQueue.push(queuedRequest);
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      
      try {
        await this.waitForRateLimit();
        const result = await request.execute();
        this.updateRequestCount();
        request.resolve(result);
      } catch (error: any) {
        if (this.is429Error(error) && request.retryCount < this.config.maxRetries) {
          // Retry with exponential backoff for 429 errors
          request.retryCount++;
          const delay = this.config.retryDelaySeconds * Math.pow(2, request.retryCount - 1);
          
          console.log(`Rate limit hit. Retrying request ${request.id} in ${delay} seconds (attempt ${request.retryCount}/${this.config.maxRetries})`);
          
          setTimeout(() => {
            this.requestQueue.unshift(request); // Put back at front of queue
            this.processQueue();
          }, delay * 1000);
        } else {
          request.reject(error);
        }
      }
    }

    this.isProcessing = false;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceWindowStart = now - this.windowStart;
    
    // Reset window if a minute has passed
    if (timeSinceWindowStart >= 60000) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // If we've hit the rate limit, wait
    if (this.requestCount >= this.config.requestsPerMinute) {
      const timeToWait = 60000 - timeSinceWindowStart;
      if (timeToWait > 0) {
        console.log(`Rate limit reached. Waiting ${Math.ceil(timeToWait / 1000)} seconds...`);
        await this.sleep(timeToWait);
        this.requestCount = 0;
        this.windowStart = Date.now();
      }
    }

    // Also ensure minimum delay between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = this.config.retryDelaySeconds * 1000;
    
    if (timeSinceLastRequest < minDelay) {
      const waitTime = minDelay - timeSinceLastRequest;
      console.log(`Enforcing minimum delay. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
      await this.sleep(waitTime);
    }
  }

  private updateRequestCount() {
    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  private is429Error(error: any): boolean {
    return error?.message?.includes('429') || 
           error?.status === 429 || 
           error?.message?.toLowerCase().includes('too many requests') ||
           error?.message?.toLowerCase().includes('rate limit');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get current queue status for UI
  getQueueStatus() {
    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessing,
      requestCount: this.requestCount,
      timeUntilNextWindow: Math.max(0, 60000 - (Date.now() - this.windowStart)),
      timeSinceLastRequest: Date.now() - this.lastRequestTime
    };
  }

  // Estimate wait time for new requests
  getEstimatedWaitTime(): number {
    const queuePosition = this.requestQueue.length;
    const baseDelay = this.config.retryDelaySeconds * 1000;
    return queuePosition * baseDelay;
  }
}