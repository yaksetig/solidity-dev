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

interface FunctionSignature {
  name: string;
  signature: string;
  purpose: string;
  dependencies: string[];
  returnType: string;
  parameters: string[];
}

interface ArchitectureJSON {
  functions: FunctionSignature[];
  dataStructures: Record<string, string>;
  mainFlow: string[];
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

  async callOpenRouterArchitect(strategy: string): Promise<string> {
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
            content: `You are a software architect. Output ONLY a valid JSON object with function signatures for crypto trading bots.

REQUIRED JSON FORMAT:
{
  "functions": [
    {
      "name": "function_name",
      "signature": "function_name(param1: type, param2: type) -> return_type",
      "purpose": "Clear description of what this function does",
      "dependencies": ["list", "of", "other", "functions", "it", "calls"],
      "returnType": "str|dict|list|float|bool",
      "parameters": ["param1: type", "param2: type"]
    }
  ],
  "dataStructures": {
    "CandleData": "Dict with keys: timestamp, open, high, low, close, volume",
    "Signal": "Dict with keys: action (buy/sell/hold), confidence, timestamp"
  },
  "mainFlow": ["step1_function", "step2_function", "step3_function"]
}

CRITICAL: Output ONLY the JSON object, no explanations, no markdown, no additional text.`
          },
          {
            role: 'user',
            content: `Convert this trading strategy into a JSON function architecture:

${strategy}

Create function signatures for:
- Data fetching (crypto prices, historical data)
- Technical indicators (moving averages, RSI, etc.)
- Signal generation (entry/exit logic) 
- Risk management (position sizing)
- Backtesting engine functions
- Main orchestration

Output ONLY valid JSON with the exact format specified.`
          }
        ],
        temperature: 0.1,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter Architect API error: ${response.status} ${response.statusText}`);
    }

    const data: OpenRouterResponse = await response.json();
    return data.choices[0]?.message?.content || 'No architecture generated';
  }

  parseArchitectureJSON(jsonString: string): ArchitectureJSON {
    try {
      // Clean the response to extract JSON
      const cleanedJson = jsonString.replace(/```json\n?|```\n?/g, '').trim();
      const startIndex = cleanedJson.indexOf('{');
      const lastIndex = cleanedJson.lastIndexOf('}');
      
      if (startIndex === -1 || lastIndex === -1) {
        throw new Error('No valid JSON object found in response');
      }
      
      const jsonStr = cleanedJson.substring(startIndex, lastIndex + 1);
      const parsed = JSON.parse(jsonStr);
      
      if (!parsed.functions || !Array.isArray(parsed.functions)) {
        throw new Error('Invalid JSON structure: missing functions array');
      }
      
      return parsed as ArchitectureJSON;
    } catch (error) {
      throw new Error(`Failed to parse architecture JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async implementFunction(functionSig: FunctionSignature, strategy: string, allFunctions: FunctionSignature[]): Promise<string> {
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
            content: `You are a Python developer implementing individual functions for crypto trading bots. 

REQUIREMENTS:
- Implement ONLY the requested function
- Use ONLY: urllib.request, json, time, math, datetime, os
- Include comprehensive docstring and error handling
- Follow the exact signature provided
- Add logging and validation where appropriate
- Output ONLY the function code, no markdown, no explanations

STYLE:
- Clear, readable code with comments
- Proper error handling with try/catch
- Type hints where possible
- Descriptive variable names`
          },
          {
            role: 'user',
            content: `Implement this function for a crypto trading strategy:

FUNCTION TO IMPLEMENT:
Name: ${functionSig.name}
Signature: ${functionSig.signature}
Purpose: ${functionSig.purpose}
Dependencies: ${functionSig.dependencies.join(', ')}

STRATEGY CONTEXT:
${strategy.substring(0, 1000)}...

OTHER FUNCTIONS IN SYSTEM:
${allFunctions.map(f => `- ${f.signature}`).join('\n')}

Implement ONLY this function with proper error handling and documentation. Use only native Python libraries.`
          }
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter Implementation API error: ${response.status} ${response.statusText}`);
    }

    const data: OpenRouterResponse = await response.json();
    return data.choices[0]?.message?.content || 'No implementation generated';
  }

  aggregateCode(implementedFunctions: { name: string; code: string }[], architecture: ArchitectureJSON, strategy: string): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    // Build the aggregated code string
    let aggregatedCode = '#!/usr/bin/env python3\n';
    aggregatedCode += '"""\n';
    aggregatedCode += `Crypto Trading Bot - Generated ${timestamp}\n`;
    aggregatedCode += 'Strategy: Auto-generated crypto trading strategy\n';
    aggregatedCode += 'Timeframe: 4-hour intervals\n';
    aggregatedCode += 'Libraries: Native Python only (urllib.request, json, time, math, datetime, os)\n';
    aggregatedCode += '"""\n\n';
    
    aggregatedCode += 'import urllib.request\n';
    aggregatedCode += 'import json\n';
    aggregatedCode += 'import time\n';
    aggregatedCode += 'import math\n';
    aggregatedCode += 'import datetime\n';
    aggregatedCode += 'import os\n';
    aggregatedCode += 'from typing import Dict, List, Optional, Tuple, Any\n\n';
    
    aggregatedCode += '# =============================================================================\n';
    aggregatedCode += '# CONFIGURATION\n';
    aggregatedCode += '# =============================================================================\n\n';
    
    aggregatedCode += 'CONFIG = {\n';
    aggregatedCode += "    'symbol': 'BTCUSDT',\n";
    aggregatedCode += "    'timeframe': '4h',\n";
    aggregatedCode += "    'interval_seconds': 4 * 60 * 60,  # 4 hours\n";
    aggregatedCode += "    'api_base': 'https://api.binance.com',\n";
    aggregatedCode += "    'backtest_days': 30,\n";
    aggregatedCode += "    'initial_balance': 10000,\n";
    aggregatedCode += "    'risk_per_trade': 0.02\n";
    aggregatedCode += '}\n\n';
    
    aggregatedCode += '# =============================================================================\n';
    aggregatedCode += '# IMPLEMENTED FUNCTIONS\n';
    aggregatedCode += '# =============================================================================\n\n';

    // Add all implemented functions
    implementedFunctions.forEach(func => {
      aggregatedCode += func.code + '\n\n';
    });

    // Add backtesting engine
    aggregatedCode += '# =============================================================================\n';
    aggregatedCode += '# BACKTESTING ENGINE\n';
    aggregatedCode += '# =============================================================================\n\n';
    
    aggregatedCode += 'def run_backtest(symbol: str, days: int = 30) -> Dict[str, Any]:\n';
    aggregatedCode += '    """\n';
    aggregatedCode += '    Comprehensive backtesting engine with performance metrics.\n';
    aggregatedCode += '    \n';
    aggregatedCode += '    Args:\n';
    aggregatedCode += '        symbol: Trading pair symbol\n';
    aggregatedCode += '        days: Number of days to backtest\n';
    aggregatedCode += '        \n';
    aggregatedCode += '    Returns:\n';
    aggregatedCode += '        Dict containing backtest results and metrics\n';
    aggregatedCode += '    """\n';
    aggregatedCode += '    try:\n';
    aggregatedCode += '        print(f"Starting backtest for {symbol} over {days} days...")\n';
    aggregatedCode += '        \n';
    aggregatedCode += '        # Fetch historical data\n';
    aggregatedCode += '        historical_data = get_historical_data(symbol, days)\n';
    aggregatedCode += '        if not historical_data:\n';
    aggregatedCode += '            return {"error": "Failed to fetch historical data"}\n';
    aggregatedCode += '        \n';
    aggregatedCode += '        # Initialize backtest variables\n';
    aggregatedCode += "        balance = CONFIG['initial_balance']\n";
    aggregatedCode += '        position = 0\n';
    aggregatedCode += '        trades = []\n';
    aggregatedCode += '        equity_curve = [balance]\n';
    aggregatedCode += '        \n';
    aggregatedCode += '        for i, candle in enumerate(historical_data[1:], 1):\n';
    aggregatedCode += '            # Get current and previous data\n';
    aggregatedCode += '            current_data = {\n';
    aggregatedCode += "                'current': candle,\n";
    aggregatedCode += "                'previous': historical_data[i-1],\n";
    aggregatedCode += "                'history': historical_data[:i]\n";
    aggregatedCode += '            }\n';
    aggregatedCode += '            \n';
    aggregatedCode += '            # Generate signal\n';
    aggregatedCode += '            signal = generate_signal(current_data)\n';
    aggregatedCode += '            \n';
    aggregatedCode += "            if signal['action'] == 'buy' and position == 0:\n";
    aggregatedCode += '                # Enter long position\n';
    aggregatedCode += "                risk_amount = balance * CONFIG['risk_per_trade']\n";
    aggregatedCode += "                position = risk_amount / candle['close']\n";
    aggregatedCode += '                balance -= risk_amount\n';
    aggregatedCode += '                trades.append({\n';
    aggregatedCode += "                    'type': 'buy',\n";
    aggregatedCode += "                    'price': candle['close'],\n";
    aggregatedCode += "                    'quantity': position,\n";
    aggregatedCode += "                    'timestamp': candle['timestamp'],\n";
    aggregatedCode += "                    'balance': balance\n";
    aggregatedCode += '                })\n';
    aggregatedCode += '                \n';
    aggregatedCode += "            elif signal['action'] == 'sell' and position > 0:\n";
    aggregatedCode += '                # Exit position\n';
    aggregatedCode += "                exit_value = position * candle['close']\n";
    aggregatedCode += '                balance += exit_value\n';
    aggregatedCode += '                trades.append({\n';
    aggregatedCode += "                    'type': 'sell',\n";
    aggregatedCode += "                    'price': candle['close'],\n";
    aggregatedCode += "                    'quantity': position,\n";
    aggregatedCode += "                    'timestamp': candle['timestamp'],\n";
    aggregatedCode += "                    'balance': balance,\n";
    aggregatedCode += "                    'pnl': exit_value - (trades[-1]['quantity'] * trades[-1]['price'])\n";
    aggregatedCode += '                })\n';
    aggregatedCode += '                position = 0\n';
    aggregatedCode += '            \n';
    aggregatedCode += '            # Update equity curve\n';
    aggregatedCode += "            current_equity = balance + (position * candle['close'] if position > 0 else 0)\n";
    aggregatedCode += '            equity_curve.append(current_equity)\n';
    aggregatedCode += '        \n';
    aggregatedCode += '        # Calculate performance metrics\n';
    aggregatedCode += "        metrics = calculate_performance_metrics(trades, equity_curve, CONFIG['initial_balance'])\n";
    aggregatedCode += '        \n';
    aggregatedCode += '        return {\n';
    aggregatedCode += "            'success': True,\n";
    aggregatedCode += "            'trades': trades,\n";
    aggregatedCode += "            'equity_curve': equity_curve,\n";
    aggregatedCode += "            'metrics': metrics,\n";
    aggregatedCode += "            'final_balance': balance + (position * historical_data[-1]['close'] if position > 0 else 0)\n";
    aggregatedCode += '        }\n';
    aggregatedCode += '        \n';
    aggregatedCode += '    except Exception as e:\n';
    aggregatedCode += '        return {"error": f"Backtest failed: {str(e)}"}\n\n';
    
    aggregatedCode += 'def calculate_performance_metrics(trades: List[Dict], equity_curve: List[float], initial_balance: float) -> Dict[str, float]:\n';
    aggregatedCode += '    """Calculate comprehensive performance metrics."""\n';
    aggregatedCode += '    try:\n';
    aggregatedCode += '        if not trades:\n';
    aggregatedCode += '            return {"error": "No trades to analyze"}\n';
    aggregatedCode += '        \n';
    aggregatedCode += '        # Basic metrics\n';
    aggregatedCode += "        total_trades = len([t for t in trades if t['type'] == 'sell'])\n";
    aggregatedCode += "        winning_trades = len([t for t in trades if t['type'] == 'sell' and t.get('pnl', 0) > 0])\n";
    aggregatedCode += '        \n';
    aggregatedCode += '        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0\n';
    aggregatedCode += '        \n';
    aggregatedCode += '        total_return = ((equity_curve[-1] - initial_balance) / initial_balance) * 100\n';
    aggregatedCode += '        \n';
    aggregatedCode += '        # Maximum drawdown\n';
    aggregatedCode += '        peak = initial_balance\n';
    aggregatedCode += '        max_drawdown = 0\n';
    aggregatedCode += '        for equity in equity_curve:\n';
    aggregatedCode += '            if equity > peak:\n';
    aggregatedCode += '                peak = equity\n';
    aggregatedCode += '            drawdown = ((peak - equity) / peak) * 100\n';
    aggregatedCode += '            max_drawdown = max(max_drawdown, drawdown)\n';
    aggregatedCode += '        \n';
    aggregatedCode += '        # Sharpe ratio (simplified)\n';
    aggregatedCode += '        returns = [equity_curve[i] / equity_curve[i-1] - 1 for i in range(1, len(equity_curve))]\n';
    aggregatedCode += '        avg_return = sum(returns) / len(returns) if returns else 0\n';
    aggregatedCode += '        return_std = math.sqrt(sum((r - avg_return) ** 2 for r in returns) / len(returns)) if returns else 1\n';
    aggregatedCode += '        sharpe_ratio = (avg_return / return_std) * math.sqrt(365) if return_std > 0 else 0\n';
    aggregatedCode += '        \n';
    aggregatedCode += '        return {\n';
    aggregatedCode += "            'total_return_pct': round(total_return, 2),\n";
    aggregatedCode += "            'total_trades': total_trades,\n";
    aggregatedCode += "            'win_rate_pct': round(win_rate, 2),\n";
    aggregatedCode += "            'max_drawdown_pct': round(max_drawdown, 2),\n";
    aggregatedCode += "            'sharpe_ratio': round(sharpe_ratio, 2),\n";
    aggregatedCode += "            'final_equity': round(equity_curve[-1], 2)\n";
    aggregatedCode += '        }\n';
    aggregatedCode += '        \n';
    aggregatedCode += '    except Exception as e:\n';
    aggregatedCode += '        return {"error": f"Metrics calculation failed: {str(e)}"}\n\n';
    
    aggregatedCode += '# =============================================================================\n';
    aggregatedCode += '# MAIN EXECUTION\n';
    aggregatedCode += '# =============================================================================\n\n';
    
    aggregatedCode += 'def main():\n';
    aggregatedCode += '    """Main execution function with mode selection."""\n';
    aggregatedCode += '    try:\n';
    aggregatedCode += "        mode = os.environ.get('MODE', 'backtest').lower()\n";
    aggregatedCode += "        symbol = os.environ.get('SYMBOL', CONFIG['symbol'])\n";
    aggregatedCode += '        \n';
    aggregatedCode += '        print(f"=== Crypto Trading Bot - {mode.upper()} MODE ===")\n';
    aggregatedCode += '        print(f"Symbol: {symbol}")\n';
    aggregatedCode += "        print(f\"Timeframe: {CONFIG['timeframe']}\")\n";
    aggregatedCode += '        print("-" * 50)\n';
    aggregatedCode += '        \n';
    aggregatedCode += "        if mode == 'backtest':\n";
    aggregatedCode += '            # Run backtesting\n';
    aggregatedCode += "            results = run_backtest(symbol, CONFIG['backtest_days'])\n";
    aggregatedCode += '            \n';
    aggregatedCode += "            if 'error' in results:\n";
    aggregatedCode += "                print(f\"❌ Backtest Error: {results['error']}\")\n";
    aggregatedCode += '                return\n';
    aggregatedCode += '            \n';
    aggregatedCode += '            print("✅ BACKTEST COMPLETED")\n';
    aggregatedCode += '            print(f"📊 Performance Metrics:")\n';
    aggregatedCode += "            for key, value in results['metrics'].items():\n";
    aggregatedCode += '                print(f"   {key}: {value}")\n';
    aggregatedCode += '            \n';
    aggregatedCode += "            print(f\"\\n💰 Final Balance: ${results['final_balance']:.2f}\")\n";
    aggregatedCode += "            print(f\"📈 Total Trades: {len(results['trades'])}\")\n";
    aggregatedCode += '            \n';
    aggregatedCode += "        elif mode == 'live':\n";
    aggregatedCode += '            # Live trading mode\n';
    aggregatedCode += '            print("🔴 LIVE TRADING MODE")\n';
    aggregatedCode += '            print("⚠️  Use at your own risk!")\n';
    aggregatedCode += '            \n';
    aggregatedCode += '            while True:\n';
    aggregatedCode += '                try:\n';
    aggregatedCode += '                    # Get current market data\n';
    aggregatedCode += '                    current_data = get_current_market_data(symbol)\n';
    aggregatedCode += '                    if not current_data:\n';
    aggregatedCode += '                        print("❌ Failed to fetch market data")\n';
    aggregatedCode += "                        time.sleep(CONFIG['interval_seconds'])\n";
    aggregatedCode += '                        continue\n';
    aggregatedCode += '                    \n';
    aggregatedCode += '                    # Generate signal\n';
    aggregatedCode += '                    signal = generate_signal(current_data)\n';
    aggregatedCode += '                    \n';
    aggregatedCode += "                    print(f\"📊 Signal: {signal['action']} (confidence: {signal['confidence']:.2f})\")\n";
    aggregatedCode += '                    \n';
    aggregatedCode += '                    # In a real implementation, you would execute trades here\n';
    aggregatedCode += '                    print("💡 Trade execution not implemented (demo mode)")\n';
    aggregatedCode += '                    \n';
    aggregatedCode += '                    # Wait for next interval\n';
    aggregatedCode += "                    time.sleep(CONFIG['interval_seconds'])\n";
    aggregatedCode += '                    \n';
    aggregatedCode += '                except KeyboardInterrupt:\n';
    aggregatedCode += '                    print("\\n🛑 Trading stopped by user")\n';
    aggregatedCode += '                    break\n';
    aggregatedCode += '                except Exception as e:\n';
    aggregatedCode += '                    print(f"❌ Live trading error: {e}")\n';
    aggregatedCode += '                    time.sleep(60)  # Wait 1 minute before retrying\n';
    aggregatedCode += '        else:\n';
    aggregatedCode += '            print(f"❌ Unknown mode: {mode}")\n';
    aggregatedCode += '            print("Available modes: backtest, live")\n';
    aggregatedCode += '            \n';
    aggregatedCode += '    except Exception as e:\n';
    aggregatedCode += '        print(f"❌ Main execution error: {e}")\n\n';
    
    aggregatedCode += 'if __name__ == "__main__":\n';
    aggregatedCode += '    main()\n';

    return aggregatedCode;
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