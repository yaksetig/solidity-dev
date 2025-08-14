import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Code, CheckCircle, AlertCircle, Settings, Brain, Zap, TestTube, CheckCircle2, Copy, Bot, User } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import ApiKeyDialog from "@/components/ApiKeyDialog";
import { APIServices } from "@/services/apiServices";
import { hasAPIKeys, loadAPIKeys } from "@/utils/storage";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface GenerationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  content?: string;
}

const ContractGenerator = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI smart contract assistant. Describe the smart contract you\'d like me to create, and I\'ll generate complete Solidity code for you. For example:\n\n- "Create an ERC-20 token with staking rewards"\n- "Build a multi-signature wallet contract"\n- "Design a simple NFT marketplace"\n\nWhat would you like to build?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [apiServices, setApiServices] = useState<APIServices | null>(null);
  const [currentSteps, setCurrentSteps] = useState<GenerationStep[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentSteps]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Check if we have API keys
    if (!hasAPIKeys()) {
      setShowApiKeyDialog(true);
      return;
    }

    // Load API keys and create services if not already done
    if (!apiServices) {
      const keys = loadAPIKeys();
      if (keys) {
        setApiServices(new APIServices(keys.perplexity, keys.openrouter));
      } else {
        setShowApiKeyDialog(true);
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsGenerating(true);

    // Initialize generation steps
    const steps: GenerationStep[] = [
      {
        id: 'analyze',
        title: 'Analyze Request',
        description: 'Understanding your smart contract requirements',
        status: 'pending'
      },
      {
        id: 'architecture',
        title: 'Generate Architecture',
        description: 'Creating contract structure with function signatures',
        status: 'pending'
      },
      {
        id: 'implementation',
        title: 'Implement Functions',
        description: 'Generating individual Solidity functions',
        status: 'pending'
      },
      {
        id: 'contract',
        title: 'Build Contract',
        description: 'Combining into complete Solidity contract',
        status: 'pending'
      },
      {
        id: 'compilation',
        title: 'Compile Contract',
        description: 'Validating and compiling with Solidity compiler',
        status: 'pending'
      },
      {
        id: 'results',
        title: 'Display Results',
        description: 'Showing compiled bytecode, ABI, and deployment info',
        status: 'pending'
      }
    ];

    setCurrentSteps(steps);

    try {
      await generateSmartContract(userMessage.content, steps);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ **Contract Generation Failed**\n\n${errorMessage}\n\nPlease try again with a different request or check your API keys.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorResponse]);
      toast.error(`Contract generation failed: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSmartContract = async (userRequest: string, steps: GenerationStep[]) => {
    if (!apiServices) return;

    try {
      // Step 1: Analyze Request
      setCurrentSteps(prev => prev.map((step, index) => 
        index === 0 ? { ...step, status: 'loading' } : step
      ));

      const analysis = await apiServices.callPerplexityAPI(
        'Solidity',
        `Analyze this smart contract request and provide detailed requirements: ${userRequest}`
      );

      setCurrentSteps(prev => prev.map((step, index) => 
        index === 0 ? { ...step, status: 'completed', content: analysis } : step
      ));

      // Step 2: Generate Architecture
      setCurrentSteps(prev => prev.map((step, index) => 
        index === 1 ? { ...step, status: 'loading' } : step
      ));

      const architectureJson = await apiServices.callOpenRouterArchitect(analysis);

      setCurrentSteps(prev => prev.map((step, index) => 
        index === 1 ? { ...step, status: 'completed', content: architectureJson } : step
      ));

      // Step 3: Implement Functions
      setCurrentSteps(prev => prev.map((step, index) => 
        index === 2 ? { ...step, status: 'loading' } : step
      ));

      const implementedFunctions = await apiServices.implementFunctionsFromJSON(architectureJson, analysis);

      setCurrentSteps(prev => prev.map((step, index) => 
        index === 2 ? { ...step, status: 'completed', content: `Implemented ${implementedFunctions.length} functions` } : step
      ));

      // Step 4: Build Contract
      setCurrentSteps(prev => prev.map((step, index) => 
        index === 3 ? { ...step, status: 'loading' } : step
      ));

      const finalContract = apiServices.aggregateContract(implementedFunctions, analysis);

      setCurrentSteps(prev => prev.map((step, index) => 
        index === 3 ? { ...step, status: 'completed', content: finalContract } : step
      ));

      // Step 5: Compile Contract
      setCurrentSteps(prev => prev.map((step, index) => 
        index === 4 ? { ...step, status: 'loading' } : step
      ));

      const compilationResult = await apiServices.compileSolidityContract(finalContract);

      setCurrentSteps(prev => prev.map((step, index) => 
        index === 4 ? { ...step, status: 'completed', content: compilationResult } : step
      ));

      // Step 6: Display Results
      setCurrentSteps(prev => prev.map((step, index) => 
        index === 5 ? { ...step, status: 'completed' } : step
      ));

      const successResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `✅ **Smart Contract Generated Successfully!**

## Contract Analysis
${analysis}

## Generated Solidity Contract
\`\`\`solidity
${finalContract}
\`\`\`

## Compilation Results
${compilationResult}

Your smart contract is ready! You can now deploy it to any Ethereum-compatible network.`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, successResponse]);
      toast.success("Smart contract generated successfully!");

    } catch (error) {
      // Mark current loading step as error
      setCurrentSteps(prev => prev.map(step => 
        step.status === 'loading' ? { ...step, status: 'error', content: `Error: ${error}` } : step
      ));
      throw error;
    }
  };

  const handleApiKeysConfigured = (configuredApiServices: APIServices) => {
    setApiServices(configuredApiServices);
    toast.success("API keys configured successfully!");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const getStepIcon = (status: GenerationStep['status'], stepId: string) => {
    const iconMap = {
      analyze: Brain,
      architecture: Zap,
      implementation: Code,
      contract: CheckCircle,
      compilation: TestTube,
      results: CheckCircle2
    };
    
    const IconComponent = iconMap[stepId as keyof typeof iconMap] || Code;
    
    switch (status) {
      case 'loading':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'completed':
        return <IconComponent className="h-3 w-3 text-success" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      default:
        return <IconComponent className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-primary rounded-lg">
                <Code className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Smart Contract AI</h1>
                <p className="text-xs text-muted-foreground">Generate Solidity contracts with AI</p>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowApiKeyDialog(true)}
              className="group"
            >
              <Settings className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform" />
              API Keys
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 container mx-auto px-4 py-6">
        <ScrollArea className="h-[calc(100vh-12rem)]" ref={scrollAreaRef}>
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((message) => (
              <div key={message.id} className="flex items-start space-x-4">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-gradient-primary text-white'
                }`}>
                  {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-foreground">
                      {message.role === 'user' ? 'You' : 'AI Assistant'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <Card className="p-4 bg-gradient-card border-border/50">
                    <div className="prose prose-sm max-w-none dark:prose-invert [&>pre]:bg-muted [&>pre]:p-3 [&>pre]:rounded [&>pre]:overflow-x-auto [&>code]:bg-muted [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-sm">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                    
                    {message.role === 'assistant' && (
                      <div className="flex justify-end mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(message.content)}
                          className="text-xs"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            ))}

            {/* Generation Steps */}
            {isGenerating && currentSteps.length > 0 && (
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-sm font-medium text-foreground">AI Assistant</span>
                    <span className="text-xs text-muted-foreground">Generating...</span>
                  </div>
                  
                  <Card className="p-4 bg-gradient-card border-border/50">
                    <div className="space-y-3">
                      {currentSteps.map((step, index) => (
                        <div key={step.id} className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {getStepIcon(step.status, step.id)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-foreground">{step.title}</span>
                              <Badge 
                                variant={
                                  step.status === 'completed' ? 'success' : 
                                  step.status === 'loading' ? 'warning' :
                                  step.status === 'error' ? 'destructive' : 'secondary'
                                }
                                className="text-xs"
                              >
                                {step.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end space-x-3">
              <div className="flex-1">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Describe the smart contract you want to create..."
                  disabled={isGenerating}
                  className="min-h-[2.5rem] resize-none"
                />
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={isGenerating || !inputValue.trim()}
                size="sm"
                className="h-10 px-4"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                Press Enter to send, Shift+Enter for new line
              </p>
              <p className="text-xs text-muted-foreground">
                {inputValue.length}/1000
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* API Key Configuration Dialog */}
      <ApiKeyDialog
        open={showApiKeyDialog}
        onClose={() => setShowApiKeyDialog(false)}
        onKeysConfigured={handleApiKeysConfigured}
      />
    </div>
  );
};

export default ContractGenerator;