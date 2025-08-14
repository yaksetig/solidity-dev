import { RateLimiter } from '@/utils/rateLimiter';

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
  private openrouterKey: string;
  private rateLimiter: RateLimiter;

  constructor(openrouterKey: string) {
    this.openrouterKey = openrouterKey;
    this.rateLimiter = new RateLimiter({
      requestsPerMinute: 100, // Claude Sonnet 4 has much higher limits
      retryDelaySeconds: 3, // Faster requests
      maxRetries: 3
    });
  }

  // Expose rate limiter status for UI
  getRateLimitStatus() {
    return this.rateLimiter.getQueueStatus();
  }

  getEstimatedWaitTime() {
    return this.rateLimiter.getEstimatedWaitTime();
  }


  async callOpenRouterArchitect(contractRequest: string): Promise<string> {
    return this.rateLimiter.makeRequest(async () => {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openrouterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4',
          messages: [
            {
              role: 'system',
              content: `You are an expert Solidity architect specializing in high-quality, well-documented smart contracts. Output ONLY a valid JSON object with comprehensive function signatures.

REQUIRED JSON FORMAT:
{
  "contractName": "ContractName",
  "functions": [
    {
      "name": "functionName",
      "signature": "function functionName(address param1, uint256 param2) public returns (bool)",
      "purpose": "Detailed explanation of function purpose, security considerations, and business logic",
      "dependencies": ["list", "of", "other", "functions", "it", "calls"],
      "returnType": "bool|uint256|address|string",
      "parameters": ["address param1", "uint256 param2"],
      "documentation": {
        "notice": "High-level description for NatSpec",
        "params": ["param1: Description of first parameter", "param2: Description of second parameter"],
        "returns": "Description of return value and conditions",
        "security": "Security considerations and potential risks"
      }
    }
  ],
  "stateVariables": {
    "variableName": "uint256 public variableName",
    "mappingName": "mapping(address => uint256) private balances"
  },
  "events": [
    "Transfer(address indexed from, address indexed to, uint256 value)"
  ],
  "imports": [
    "@openzeppelin/contracts/token/ERC20/ERC20.sol"
  ]
}

CRITICAL: Output ONLY the JSON object, no explanations, no markdown, no additional text.`
            },
            {
              role: 'user',
              content: `Convert this smart contract request into a JSON function architecture:

${contractRequest}

Create function signatures for:
- Core contract functionality (transfer, approve, etc.)
- Access control and security functions
- Business logic specific to the contract type
- View functions for reading state
- Event emissions for important state changes
- Constructor for initialization

Output ONLY valid JSON with the exact format specified.`
            }
          ],
          temperature: 0.1,
          max_tokens: 8000, // Much higher for complete JSON responses
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter Architect API error: ${response.status} ${response.statusText}`);
      }

      const data: OpenRouterResponse = await response.json();
      return data.choices[0]?.message?.content || 'No architecture generated';
    }, 'architect');
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
      
      // Validate JSON is complete before parsing
      const braceCount = (jsonStr.match(/\{/g) || []).length - (jsonStr.match(/\}/g) || []).length;
      if (braceCount !== 0) {
        throw new Error(`Incomplete JSON detected (unmatched braces: ${braceCount}). The response may have been truncated. Try again with a simpler request.`);
      }
      
      const parsed = JSON.parse(jsonStr);
      
      if (!parsed.functions || !Array.isArray(parsed.functions)) {
        throw new Error('Invalid JSON structure: missing functions array');
      }
      
      return parsed as ArchitectureJSON;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`JSON parsing failed - response may be truncated. Try simplifying your contract requirements. Error: ${error.message}`);
      }
      throw new Error(`Failed to parse architecture JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async implementFunctionsFromJSON(architectureJson: string, contractRequest: string): Promise<{ name: string; code: string }[]> {
    // Parse the JSON directly
    const architecture = this.parseArchitectureJSON(architectureJson);
    const implementedFunctions: { name: string; code: string }[] = [];
    
    // Batch functions by type for more efficient API calls
    const functionBatches = this.batchFunctionsByType(architecture.functions);
    
    // Process each batch with rate limiting
    for (const batch of functionBatches) {
      try {
        const batchCode = await this.implementFunctionBatch(batch, contractRequest, architecture.functions);
        implementedFunctions.push(...batchCode);
      } catch (error) {
        console.error(`Failed to implement function batch:`, error);
        // Add error placeholders for failed batch
        batch.forEach(func => {
          implementedFunctions.push({ 
            name: func.name, 
            code: `// ERROR: Failed to implement ${func.name}\n// ${error instanceof Error ? error.message : 'Unknown error'}\nfunction ${func.name}() public {\n    revert("Function implementation failed");\n}`
          });
        });
      }
    }
    
    return implementedFunctions;
  }

  private batchFunctionsByType(functions: FunctionSignature[]): FunctionSignature[][] {
    // Group functions by type to reduce API calls
    const constructors = functions.filter(f => f.name.toLowerCase().includes('constructor'));
    const viewFunctions = functions.filter(f => f.signature.includes('view') || f.signature.includes('pure'));
    const stateFunctions = functions.filter(f => !f.signature.includes('view') && !f.signature.includes('pure') && !f.name.toLowerCase().includes('constructor'));
    
    const batches: FunctionSignature[][] = [];
    
    // Create smaller batches to stay within token limits
    const maxBatchSize = 3;
    
    [constructors, viewFunctions, stateFunctions].forEach(group => {
      for (let i = 0; i < group.length; i += maxBatchSize) {
        const batch = group.slice(i, i + maxBatchSize);
        if (batch.length > 0) {
          batches.push(batch);
        }
      }
    });
    
    return batches;
  }

  private async implementFunctionBatch(batch: FunctionSignature[], contractRequest: string, allFunctions: FunctionSignature[]): Promise<{ name: string; code: string }[]> {
    return this.rateLimiter.makeRequest(async () => {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openrouterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4',
          messages: [
            {
              role: 'system',
              content: `You are an expert Solidity developer specializing in secure, well-documented smart contracts. Generate complete function implementations with comprehensive NatSpec documentation.

CRITICAL RULES:
- Generate ALL requested functions in one response with full NatSpec documentation
- Each function must include complete /// @notice, /// @param, /// @return comments
- Add inline comments explaining complex logic and security measures
- Include proper access control (onlyOwner, nonReentrant where appropriate)
- Follow OpenZeppelin patterns and best practices
- Add require statements with clear error messages
- Include event emissions for state changes
- Separate functions with double newlines
- NO markdown blocks, just raw Solidity code with documentation
- Use latest Solidity syntax and security patterns

DOCUMENTATION FORMAT:
/// @notice Clear description of what the function does
/// @param paramName Description of the parameter and its constraints
/// @return Description of return value and conditions
/// @dev Additional technical details, security notes, gas considerations`
            },
            {
              role: 'user',
              content: `Implement these ${batch.length} Solidity functions:

${batch.map(f => `FUNCTION: ${f.signature}\nPURPOSE: ${f.purpose}`).join('\n\n')}

CONTRACT CONTEXT: ${contractRequest}

ALL FUNCTIONS IN CONTRACT:
${allFunctions.map(f => `- ${f.signature}`).join('\n')}

Generate complete implementations for ALL ${batch.length} functions above. Return only raw Solidity code.`
            }
          ],
          temperature: 0.1,
          max_tokens: 2500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter Implementation API error: ${response.status} ${response.statusText}`);
      }

      const data: OpenRouterResponse = await response.json();
      const rawCode = data.choices[0]?.message?.content || 'No implementation generated';
      
      // Parse the batch response into individual functions
      return this.parseBatchFunctionResponse(rawCode, batch);
    }, `batch-${batch.map(f => f.name).join('-')}`);
  }

  private parseBatchFunctionResponse(rawCode: string, expectedFunctions: FunctionSignature[]): { name: string; code: string }[] {
    const functions: { name: string; code: string }[] = [];
    
    // Split by function boundaries
    const functionBlocks = rawCode.split(/(?=\s*function\s+)/);
    
    expectedFunctions.forEach((expectedFunc, index) => {
      const block = functionBlocks[index + 1] || functionBlocks[0]; // +1 because first split is usually empty
      if (block) {
        const cleanedCode = this.extractSolidityCode(block);
        functions.push({
          name: expectedFunc.name,
          code: cleanedCode
        });
      } else {
        // Fallback if parsing fails
        functions.push({
          name: expectedFunc.name,
          code: `function ${expectedFunc.name}() public {\n    // TODO: Implement function\n    revert("Not implemented");\n}`
        });
      }
    });
    
    return functions;
  }

  async implementFunction(functionSig: FunctionSignature, contractRequest: string, allFunctions: FunctionSignature[]): Promise<string> {
    return this.rateLimiter.makeRequest(async () => {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openrouterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4',
          messages: [
            {
              role: 'system',
              content: `You are an expert Solidity developer. Generate a single, complete, well-documented function with comprehensive NatSpec documentation.

CRITICAL RULES:
- OUTPUT ONLY SOLIDITY CODE WITH NATSPEC DOCUMENTATION
- Start with /// @notice and include all relevant NatSpec tags
- Add inline comments for complex logic and security measures
- Include proper access control and security patterns
- Use OpenZeppelin imports and patterns when appropriate
- Add comprehensive error handling with descriptive messages
- Include event emissions for state changes
- Follow the exact signature provided
- NO markdown blocks, just raw Solidity code

EXAMPLE OUTPUT:
/// @notice Transfers tokens from sender to recipient
/// @param to The recipient address (must not be zero address)
/// @param amount The amount of tokens to transfer
/// @return success True if transfer completed successfully
/// @dev Emits Transfer event on successful transfer
function transfer(address to, uint256 amount) public returns (bool success) {
    require(to != address(0), "ERC20: transfer to zero address");
    require(balances[msg.sender] >= amount, "ERC20: insufficient balance");
    
    // Update balances
    balances[msg.sender] -= amount;
    balances[to] += amount;
    
    // Emit transfer event
    emit Transfer(msg.sender, to, amount);
    return true;
}`
            },
            {
              role: 'user',
              content: `IMPLEMENT THIS FUNCTION:
${functionSig.signature}

PURPOSE: ${functionSig.purpose}

CONTRACT CONTEXT:
${contractRequest}

OTHER FUNCTIONS IN CONTRACT:
${allFunctions.map(f => `- ${f.signature}`).join('\n')}

OUTPUT ONLY THE SOLIDITY FUNCTION CODE. NO MARKDOWN. NO EXPLANATIONS. START WITH 'function' AND END WITH PROPER CLOSING BRACE.`
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
      const rawCode = data.choices[0]?.message?.content || 'No implementation generated';
      return this.extractSolidityCode(rawCode);
    }, `function-${functionSig.name}`);
  }

  private extractSolidityCode(rawResponse: string): string {
    try {
      // Remove markdown code blocks
      let cleaned = rawResponse.replace(/```solidity\n?|```\n?/g, '').trim();
      
      // Remove any text before the first 'function '
      const functionIndex = cleaned.indexOf('function ');
      if (functionIndex > 0) {
        cleaned = cleaned.substring(functionIndex);
      }
      
      // Extract the complete function by counting braces
      const lines = cleaned.split('\n');
      const functionLines: string[] = [];
      let braceCount = 0;
      let insideFunction = false;
      
      for (const line of lines) {
        if (line.trim().startsWith('function ')) {
          insideFunction = true;
          functionLines.push(line);
          // Count opening braces in this line
          braceCount += (line.match(/\{/g) || []).length;
          braceCount -= (line.match(/\}/g) || []).length;
        } else if (insideFunction) {
          functionLines.push(line);
          // Count braces to know when function ends
          braceCount += (line.match(/\{/g) || []).length;
          braceCount -= (line.match(/\}/g) || []).length;
          
          // If brace count reaches 0, we've closed the function
          if (braceCount <= 0) {
            break;
          }
        }
      }
      
      return functionLines.join('\n').trim() || rawResponse;
    } catch (error) {
      console.warn('Failed to extract Solidity code, returning raw response:', error);
      return rawResponse;
    }
  }

  aggregateContract(implementedFunctions: { name: string; code: string }[], contractRequest: string): string {
    // Parse the architecture to get contract structure
    let contractName = 'GeneratedContract';
    let stateVariables: string[] = [];
    let events: string[] = [];
    let imports: string[] = [];
    let constructor = '';

    try {
      // Try to extract structure info from the first implemented function or use defaults
      contractName = 'SmartContract';
      imports = [
        '// SPDX-License-Identifier: MIT',
        'pragma solidity ^0.8.19;',
        '',
        'import "@openzeppelin/contracts/access/Ownable.sol";',
        'import "@openzeppelin/contracts/security/ReentrancyGuard.sol";'
      ];
      
      // Basic state variables that most contracts need
      stateVariables = [
        '    mapping(address => uint256) private balances;',
        '    uint256 public totalSupply;',
        '    string public name;',
        '    string public symbol;'
      ];
      
      // Common events
      events = [
        '    event Transfer(address indexed from, address indexed to, uint256 value);',
        '    event Approval(address indexed owner, address indexed spender, uint256 value);'
      ];
      
      // Basic constructor
      constructor = `    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        totalSupply = 1000000 * 10**18; // 1 million tokens
        balances[msg.sender] = totalSupply;
    }`;
      
    } catch (error) {
      console.warn('Could not parse contract structure, using defaults');
    }

    // Build the complete contract
    const contractCode = `${imports.join('\n')}

contract ${contractName} is Ownable, ReentrancyGuard {
${stateVariables.join('\n')}

${events.join('\n')}

${constructor}

${implementedFunctions.map(f => '    ' + f.code.split('\n').join('\n    ')).join('\n\n')}
}`;

    return contractCode;
  }

  aggregateCode(implementedFunctions: { name: string; code: string }[], strategy: string): string {
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
    return this.rateLimiter.makeRequest(async () => {
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
    }, 'codegen');
  }

  async compileSolidityContract(solidityCode: string): Promise<string> {
    return this.rateLimiter.makeRequest(async () => {
      try {
      const response = await fetch('https://solidity-compiler.up.railway.app/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: solidityCode,
          settings: {
            optimizer: {
              enabled: true,
              runs: 200
            },
            outputSelection: {
              "*": {
                "*": ["abi", "evm.bytecode"]
              }
            }
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Compilation API error: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errors && result.errors.length > 0) {
        const errors = result.errors.map((err: any) => err.formattedMessage).join('\n');
        return `❌ **Compilation Errors:**\n\`\`\`\n${errors}\n\`\`\``;
      }

      if (result.contracts) {
        const contractNames = Object.keys(result.contracts);
        if (contractNames.length > 0) {
          const contract = result.contracts[contractNames[0]];
          const contractData = Object.values(contract)[0] as any;
          
          return `✅ **Compilation Successful!**

**Contract ABI:**
\`\`\`json
${JSON.stringify(contractData.abi, null, 2)}
\`\`\`

**Bytecode Size:** ${contractData.evm.bytecode.object.length / 2} bytes

**Gas Estimation:** ~${Math.floor(contractData.evm.bytecode.object.length / 2 * 20)} gas for deployment

The contract compiled successfully and is ready for deployment!`;
        }
      }

        return '✅ Contract compiled successfully but no output generated.';
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return `❌ **Compilation Failed:**\n\nError: ${errorMessage}\n\nPlease check your Solidity code for syntax errors.`;
      }
    }, 'compilation');
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

  async testApiConnections(): Promise<{ openrouter: boolean }> {
    const results = { openrouter: false };

    // Test OpenRouter
    try {
      await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openrouterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4',
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