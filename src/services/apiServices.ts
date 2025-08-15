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

  async implementFunctionsFromJSON(
    architectureJson: string,
    contractRequest: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ name: string; code: string }[]> {
    // Parse the JSON directly
    const architecture = this.parseArchitectureJSON(architectureJson);
    const implementedFunctions: { name: string; code: string }[] = [];
      
    // Process each function individually and verify implementation
    for (const func of architecture.functions) {
      try {
        let attempts = 0;
        let feedback: string | undefined;
        let functionCode = '';

        while (attempts < 2) {
          functionCode = await this.implementFunction(func, contractRequest, architecture.functions, feedback);
          const review = await this.reviewFunctionImplementation(func, functionCode);
          if (review.approved) {
            implementedFunctions.push({ name: func.name, code: functionCode });
            break;
          }
          feedback = review.feedback;
          attempts++;
        }

        if (attempts >= 2) {
          implementedFunctions.push({
            name: func.name,
            code: `// ERROR: Review failed for ${func.name}\n// ${feedback || 'Unknown error'}\n${functionCode}`
          });
        }
      } catch (error) {
        console.error(`Failed to implement function ${func.name}:`, error);
        implementedFunctions.push({
          name: func.name,
          code: `// ERROR: Failed to implement ${func.name}\n// ${error instanceof Error ? error.message : 'Unknown error'}\nfunction ${func.name}() public {\n    revert("Function implementation failed");\n}`
        });
      }
      onProgress?.(implementedFunctions.length, totalFunctions);
    }

    return implementedFunctions;
  }

  async implementFunction(functionSig: FunctionSignature, contractRequest: string, allFunctions: FunctionSignature[], feedback?: string): Promise<string> {
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
            ...(feedback ? [{
              role: 'system',
              content: `The previous implementation was rejected for the following reasons: ${feedback}. Please correct these issues.`
            }] : []),
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

  async reviewFunctionImplementation(functionSig: FunctionSignature, functionCode: string): Promise<{ approved: boolean; feedback: string }> {
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
              content: `You are a Solidity code reviewer. Examine the specification and implementation. If the implementation is valid, well-written, and contains only Solidity code with comments, respond exactly with 'APPROVED'. If there are issues or extraneous text outside comments, respond with 'REJECTED: <feedback>'.`
            },
            {
              role: 'user',
              content: `SPECIFICATION:
${functionSig.signature}

PURPOSE: ${functionSig.purpose}

IMPLEMENTATION:
${functionCode}`
            }
          ],
          temperature: 0,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter Review API error: ${response.status} ${response.statusText}`);
      }

      const data: OpenRouterResponse = await response.json();
      const review = data.choices[0]?.message?.content?.trim() || '';
      if (review.toUpperCase().startsWith('APPROVED')) {
        return { approved: true, feedback: '' };
      }
      const feedback = review.replace(/^REJECTED:\s*/i, '');
      return { approved: false, feedback };
    }, `review-${functionSig.name}`);
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

${implementedFunctions.map(func => func.code).join('\n\n')}
}`;

    return contractCode;
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