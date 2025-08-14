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
            content: `You are a quantitative crypto trading strategist. Generate detailed algorithmic trading strategies for SINGLE CRYPTOCURRENCY trading on 4-hour intervals. Your strategy must be implementable in a SINGLE Python file using ONLY native Python libraries (no external imports).

Required sections:
1. STRATEGY OVERVIEW: Name and description for 4h crypto trading
2. TARGET ASSET: ONE specific cryptocurrency (${asset})
3. DATA SOURCE: Specific crypto exchange REST API endpoints (no libraries needed)
4. TECHNICAL INDICATORS: Mathematical formulas using only basic math operations
5. ENTRY CONDITIONS: Precise conditions based on 4h candle data
6. EXIT CONDITIONS: Stop-loss and take-profit rules
7. RISK MANAGEMENT: Position sizing as percentage of capital
8. NATIVE IMPLEMENTATION: How to implement using only urllib, json, time, math modules

Focus on strategies that work with 4-hour timeframes and can be coded in a single Python file.`
          },
          {
            role: 'user',
            content: `Generate a crypto trading strategy for ${asset} using 4-hour intervals. The strategy must:
- Target ONE specific cryptocurrency: ${asset}
- Use 4-hour candlestick data
- Be implementable in a single Python file
- Use ONLY native Python libraries (urllib, json, time, math)
- Include specific API endpoints for data fetching
- Provide exact mathematical formulas for indicators

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
            content: `You are a Python architect specializing in single-file crypto trading bots. Convert trading strategies into implementation plans for SINGLE Python files using ONLY native libraries.

Your plan must specify:
1. SINGLE FILE STRUCTURE: All code in one main.py file
2. NATIVE MODULES ONLY: urllib.request, json, time, math, datetime
3. API INTEGRATION: Direct HTTP requests using urllib
4. DATA PROCESSING: Manual implementation of indicators
5. EXECUTION LOGIC: Step-by-step trading decisions
6. ERROR HANDLING: Try/except blocks for network requests
7. CONFIGURATION: Hardcoded or simple variable settings
8. MAIN LOOP: 4-hour interval execution structure

NO external dependencies. NO separate files. ALL functionality in ONE file.`
          },
          {
            role: 'user',
            content: `Create a detailed implementation plan for this single-file crypto trading strategy:

${strategy}

The plan must focus on:
1. Single Python file architecture
2. Native library usage only (urllib, json, time, math)
3. 4-hour interval execution
4. Direct API calls for crypto data
5. Manual indicator calculations
6. Complete trading logic in one file`
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
            content: `You are a Python developer creating single-file crypto trading bots. Generate a complete Python script that:

REQUIREMENTS:
- Single file with ALL functionality
- Uses ONLY: urllib.request, json, time, math, datetime, os
- Makes direct HTTP requests to crypto APIs
- Implements technical indicators with basic math
- Runs on 4-hour intervals
- Includes proper error handling
- Has clear comments and docstrings

OUTPUT FORMAT:
- Generate ONLY Python code
- No markdown, no explanations
- Complete executable script
- All functions in one file`
          },
          {
            role: 'user',
            content: `Generate a complete single-file Python trading bot based on this plan:

${plan}

Ensure the code:
1. Is a complete, executable Python script
2. Uses only native libraries (urllib.request, json, time, math, datetime)
3. Implements all indicators manually
4. Makes direct HTTP requests for crypto data
5. Runs on 4-hour intervals
6. Includes error handling and logging
7. Has clear structure and comments`
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