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
            content: 'Be precise and concise. Focus on algorithmic trading strategies that use real APIs.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 1000
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
        model: 'meta/llama-3.1-8b-instruct',
        messages: [
          {
            role: 'system',
            content: 'You are a senior Python developer. Create detailed implementation plans for trading strategies.'
          },
          {
            role: 'user',
            content: `Create an implementation plan to hand out to a developer for this trading strategy: ${strategy}`
          }
        ],
        temperature: 0.1,
        top_p: 0.9,
        max_tokens: 1024,
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
        model: 'meta/llama-3.1-70b-instruct',
        messages: [
          {
            role: 'system',
            content: 'You are an expert Python developer. Generate only Python code, no explanations. Focus on algorithmic trading implementations.'
          },
          {
            role: 'user',
            content: `Generate Python code for this implementation plan: ${plan}. Only return Python code, no markdown or explanations.`
          }
        ],
        temperature: 0.1,
        top_p: 0.9,
        max_tokens: 2048,
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
          model: 'meta/llama-3.1-8b-instruct',
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