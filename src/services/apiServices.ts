interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class APIServices {
  private perplexityKey: string;
  private openrouterKey: string;

  constructor(perplexityKey: string, openrouterKey: string) {
    this.perplexityKey = perplexityKey;
    this.openrouterKey = openrouterKey;
  }

  async callPerplexityAPI(asset: string, prompt: string): Promise<string> {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: `You are a professional crypto trading strategist. Create comprehensive trading strategies that focus purely on market analysis and trading logic. DO NOT mention any technical implementation details, programming languages, or coding concepts.

Required sections:
1. STRATEGY OVERVIEW: Name and core trading philosophy for 4h crypto trading
2. TARGET ASSET: ONE specific cryptocurrency (${asset}) and market characteristics
3. MARKET ANALYSIS: Key market conditions and patterns to identify
4. TECHNICAL INDICATORS: Conceptual indicators and their trading significance (e.g., "moving averages to identify trend direction")
5. ENTRY CONDITIONS: Clear market signals that trigger buy decisions
6. EXIT CONDITIONS: Clear market signals for stop-loss and take-profit
7. RISK MANAGEMENT: Position sizing philosophy and risk tolerance
8. MARKET TIMING: Why 4-hour timeframes work for this strategy

Focus on pure trading strategy without any mention of APIs, code, libraries, or technical implementation.`
          },
          {
            role: 'user',
            content: `Create a comprehensive crypto trading strategy for ${asset} using 4-hour intervals. Focus purely on the trading logic and market analysis:

- Target cryptocurrency: ${asset}
- Trading timeframe: 4-hour candlesticks
- Market conditions and patterns to identify
- Technical indicators and their significance
- Entry and exit decision criteria
- Risk management approach
- Strategy rationale and market timing

DO NOT include any technical implementation details, code, or programming concepts. Focus on pure trading strategy.

${prompt}`
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 2000,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'month',
        frequency_penalty: 1,
        presence_penalty: 0
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
    }

    const data: PerplexityResponse = await response.json();
    return data.choices[0]?.message?.content || 'No strategy generated';
  }

  async callOpenRouterPlanning(strategy: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openrouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content: `You are a software architect specializing in function design. Convert trading strategies into clear function signatures and architectural blueprints.

Your output must specify:
1. FUNCTION SIGNATURES: Name, parameters, and return types for each function
2. DATA FLOW: How data moves between functions
3. CORE FUNCTIONS: Essential functions needed for the strategy
4. INPUT/OUTPUT SPECIFICATIONS: What each function receives and returns
5. ARCHITECTURE OVERVIEW: How functions work together
6. DATA STRUCTURES: Key data formats used throughout

Focus ONLY on function names, signatures, and architecture. DO NOT provide implementation details or actual code.`
          },
          {
            role: 'user',
            content: `Convert this trading strategy into a functional architecture blueprint:

${strategy}

Create function signatures and architecture for:
1. DATA FETCHING FUNCTIONS: Function names, parameters, and return types for getting market data
2. INDICATOR FUNCTIONS: Function signatures for calculating technical indicators
3. STRATEGY FUNCTIONS: Functions for entry/exit decision logic
4. RISK MANAGEMENT FUNCTIONS: Functions for position sizing and risk control
5. MAIN ORCHESTRATION: High-level function that coordinates everything
6. DATA STRUCTURES: Key data formats passed between functions

Provide ONLY function signatures like:
- get_market_data(symbol: str, timeframe: str) -> List[Dict]
- calculate_moving_average(prices: List[float], period: int) -> float
- check_entry_signal(data: Dict) -> bool

NO implementation details, NO actual code, ONLY function signatures and architecture.`
          }
        ],
        temperature: 0.1,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter Planning API error: ${response.status} ${response.statusText}`);
    }

    const data: OpenRouterResponse = await response.json();
    return data.choices[0]?.message?.content || 'No plan generated';
  }

  async callOpenRouterCodegen(plan: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openrouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: `You are a Python developer creating comprehensive crypto trading bots with backtesting capabilities. Generate a complete Python script that includes BOTH live trading and backtesting functionality.

REQUIREMENTS:
- Single file with ALL functionality including backtesting engine
- Uses ONLY: urllib.request, json, time, math, datetime, os
- Makes direct HTTP requests to crypto APIs
- Implements technical indicators with basic math
- Runs on 4-hour intervals
- CRITICAL: Includes comprehensive backtesting engine with historical data
- Performance metrics: Sharpe ratio, max drawdown, win rate, total return
- Backtest visualization and results reporting
- Mode switching between live trading and backtesting

BACKTESTING REQUIREMENTS:
- Fetch historical price data for backtesting
- Simulate trades based on strategy signals
- Calculate performance metrics and statistics
- Generate backtest report with key metrics
- Include data visualization (ASCII charts if needed)

OUTPUT FORMAT:
- Generate ONLY Python code
- No markdown, no explanations
- Complete executable script with backtesting
- All functions in one file`
          },
          {
            role: 'user',
            content: `Generate a complete single-file Python trading bot with comprehensive backtesting based on this architecture:

${plan}

Ensure the code includes:
1. Complete executable Python script with backtesting engine
2. Uses only native libraries (urllib.request, json, time, math, datetime, os)
3. Implements all indicators manually
4. Makes direct HTTP requests for crypto data
5. CRITICAL: Full backtesting functionality with historical data
6. Performance metrics calculation (Sharpe ratio, max drawdown, win rate)
7. Mode switching between live trading and backtesting
8. Backtest results reporting and visualization
9. Error handling and logging for both modes
10. Clear structure with docstrings and comments

The script must be able to run backtests to validate strategy performance before live trading.`
          }
        ],
        temperature: 0.05,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter CodeGen API error: ${response.status} ${response.statusText}`);
    }

    const data: OpenRouterResponse = await response.json();
    return data.choices[0]?.message?.content || 'No code generated';
  }

  async validateWithRailwayAPI(code: string): Promise<string> {
    try {
      const response = await fetch('https://my-python-api.up.railway.app/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        throw new Error(`Railway API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        return '✅ Code runs successfully on Railway API';
      } else {
        return `❌ Railway execution error: ${result.error || 'Unknown error'}`;
      }
    } catch (error) {
      console.error('Railway API validation failed:', error);
      return `⚠️ Railway API unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  validateCode(code: string): string {
    const issues: string[] = [];
    
    // Check for native libraries only
    const allowedImports = ['urllib.request', 'json', 'time', 'math', 'datetime', 'os'];
    const importLines = code.match(/^import .+$/gm) || [];
    const fromImportLines = code.match(/^from .+ import .+$/gm) || [];
    
    [...importLines, ...fromImportLines].forEach(line => {
      const isAllowed = allowedImports.some(allowed => line.includes(allowed));
      if (!isAllowed && !line.includes('#')) {
        issues.push(`Unsupported import: ${line.trim()}`);
      }
    });
    
    // Check for single file structure
    if (!code.includes('def ')) {
      issues.push('No functions detected - code structure may be incomplete');
    }
    
    if (!code.includes('if __name__ == "__main__":')) {
      issues.push('Missing main execution block');
    }
    
    // Check for crypto trading components
    const cryptoKeywords = ['btc', 'eth', 'crypto', 'binance', 'price', 'candle'];
    const hasCrypto = cryptoKeywords.some(keyword => 
      code.toLowerCase().includes(keyword)
    );
    
    if (!hasCrypto) {
      issues.push('No crypto trading logic detected');
    }
    
    // Check for 4-hour interval logic
    if (!code.includes('4h') && !code.includes('14400') && !code.includes('4 * 60 * 60')) {
      issues.push('No 4-hour interval logic detected');
    }
    
    if (issues.length === 0) {
      return '✅ Code validation passed - single-file crypto strategy structure looks good';
    } else {
      return `⚠️ Code validation issues:\n${issues.map(issue => `• ${issue}`).join('\n')}`;
    }
  }

  async testApiConnections(): Promise<{ perplexity: boolean; openrouter: boolean }> {
    const results = { perplexity: false, openrouter: false };

    // Test Perplexity
    try {
      await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.perplexityKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        }),
      });
      results.perplexity = true;
    } catch (error) {
      console.error('Perplexity API test failed:', error);
    }

    // Test OpenRouter
    try {
      await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openrouterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        }),
      });
      results.openrouter = true;
    } catch (error) {
      console.error('OpenRouter API test failed:', error);
    }

    return results;
  }
}