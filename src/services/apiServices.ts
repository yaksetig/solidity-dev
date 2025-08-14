interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface NvidiaResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class APIServices {
  private perplexityKey: string;
  private nvidiaKey: string;

  constructor(perplexityKey: string, nvidiaKey: string) {
    this.perplexityKey = perplexityKey;
    this.nvidiaKey = nvidiaKey;
  }

  async callPerplexityAPI(prompt: string): Promise<string> {
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
            content: `You are a quantitative trading strategist. Generate detailed algorithmic trading strategies that must include:

1. STRATEGY OVERVIEW: Clear name and 2-3 sentence description
2. MARKET FOCUS: Specific markets/instruments to trade (e.g., crypto pairs, forex, stocks)
3. DATA REQUIREMENTS: Exact APIs needed (Binance for prices, DefiLlama for TVL, etc.)
4. TECHNICAL INDICATORS: Specific indicators and their parameters
5. ENTRY CONDITIONS: Precise mathematical conditions for opening positions
6. EXIT CONDITIONS: Specific stop-loss, take-profit, and exit rules
7. RISK MANAGEMENT: Position sizing rules and maximum exposure limits
8. IMPLEMENTATION REQUIREMENTS: Key Python libraries and API endpoints needed

Format your response with clear sections using these exact headers. Be specific with numbers, thresholds, and mathematical formulas.`
          },
          {
            role: 'user',
            content: `Generate one complete algorithmic trading strategy that uses at most 2 APIs: Binance and DefiLlama. 
Focus on: ${prompt}
Complexity level: intermediate
Include all 8 required sections in your response.`
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
    }

    const data: PerplexityResponse = await response.json();
    return data.choices[0]?.message?.content || 'No strategy generated';
  }

  async callNvidiaPlanning(strategy: string): Promise<string> {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.nvidiaKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: `You are a senior Python developer specializing in algorithmic trading systems. You receive structured trading strategies and must create detailed implementation plans.

Your implementation plan must include:

1. PROJECT STRUCTURE: File organization and module breakdown
2. DEPENDENCIES: Required Python packages and versions
3. API INTEGRATION: Specific endpoint implementations for each required API
4. DATA PIPELINE: How to fetch, process, and store market data
5. STRATEGY LOGIC: Step-by-step implementation of entry/exit conditions
6. RISK MANAGEMENT: Implementation of position sizing and risk controls
7. TESTING FRAMEWORK: Unit tests and backtesting approach
8. DEPLOYMENT CONSIDERATIONS: Error handling, logging, and monitoring

Provide concrete implementation steps, not just high-level concepts.`
          },
          {
            role: 'user',
            content: `Based on this structured trading strategy, create a detailed implementation plan with all 8 required sections:

${strategy}`
          }
        ],
        temperature: 1,
        top_p: 1,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`NVIDIA Planning API error: ${response.status} ${response.statusText}`);
    }

    const data: NvidiaResponse = await response.json();
    return data.choices[0]?.message?.content || 'No plan generated';
  }

  async callNvidiaCodegen(plan: string): Promise<string> {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.nvidiaKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: `You are an expert Python developer. Generate production-ready algorithmic trading code based on the provided implementation plan.

Requirements:
- Use proper error handling and logging
- Include docstrings for all functions and classes
- Implement proper configuration management
- Add rate limiting for API calls
- Include basic backtesting functionality
- Follow PEP 8 style guidelines

Generate ONLY Python code with no markdown formatting or explanations.`
          },
          {
            role: 'user',
            content: `Generate production-ready Python code based on this detailed implementation plan:

${plan}

Generate ONLY Python code with no markdown or explanations.`
          }
        ],
        temperature: 1,
        top_p: 1,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`NVIDIA CodeGen API error: ${response.status} ${response.statusText}`);
    }

    const data: NvidiaResponse = await response.json();
    return data.choices[0]?.message?.content || 'No code generated';
  }

  validateCode(code: string): string {
    const validationResults: string[] = [];
    
    // Basic Python syntax checks
    if (code.includes('import ')) {
      validationResults.push('✅ Import statements found');
    } else {
      validationResults.push('⚠️ No import statements detected');
    }

    if (code.includes('class ') || code.includes('def ')) {
      validationResults.push('✅ Functions/Classes defined');
    } else {
      validationResults.push('⚠️ No functions or classes found');
    }

    if (code.includes('ccxt') || code.includes('binance')) {
      validationResults.push('✅ Trading API integration detected');
    } else {
      validationResults.push('⚠️ No trading API integration found');
    }

    // Basic syntax validation
    const lines = code.split('\n');
    let indentationConsistent = true;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() && line.startsWith(' ') && !line.startsWith('    ') && !line.startsWith('\t')) {
        indentationConsistent = false;
        break;
      }
    }

    if (indentationConsistent) {
      validationResults.push('✅ Indentation appears consistent');
    } else {
      validationResults.push('⚠️ Inconsistent indentation detected');
    }

    validationResults.push('');
    validationResults.push('⚠️ Manual testing recommended before live trading');
    validationResults.push('⚠️ Add proper error handling and logging');
    validationResults.push('⚠️ Test with paper trading first');

    return validationResults.join('\n');
  }

  async testApiConnections(): Promise<{ perplexity: boolean; nvidia: boolean }> {
    const results = { perplexity: false, nvidia: false };

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

    // Test NVIDIA
    try {
      await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.nvidiaKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        }),
      });
      results.nvidia = true;
    } catch (error) {
      console.error('NVIDIA API test failed:', error);
    }

    return results;
  }
}