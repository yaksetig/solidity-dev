import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Send, Code, CheckCircle, AlertCircle, Settings, Brain, Zap, TestTube, CheckCircle2, Copy, Bot, User, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import ApiKeyDialog from "@/components/ApiKeyDialog";
import { APIServices } from "@/services/apiServices";
import { hasAPIKeys, loadAPIKeys } from "@/utils/storage";
import { useRateLimitStatus } from "@/hooks/useRateLimitStatus";

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
      content: "Hello! I'm your AI smart contract assistant. Describe the smart contract you'd like me to create, and I'll generate audited and tested Solidity code for you.",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [apiServices, setApiServices] = useState<APIServices | null>(null);
  const [currentSteps, setCurrentSteps] = useState<GenerationStep[]>([]);
  const [architectureJson, setArchitectureJson] = useState<string | null>(null);
  const [isArchitectureExpanded, setIsArchitectureExpanded] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const rateLimitStatus = useRateLimitStatus(apiServices);

  const formatJSON = (json: string) => {
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  };

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
        setApiServices(new APIServices(keys.openrouter));
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

    // Initialize generation steps (simplified to 5 steps)
    const steps: GenerationStep[] = [
      {
        id: 'architecture',
        title: 'Generate Architecture',
        description: 'Analyzing requirements and creating contract structure',
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
      // Step 1: Generate Architecture (with comprehensive analysis)
      setCurrentSteps(prev => prev.map((step, index) => 
        index === 0 ? { ...step, status: 'loading' } : step
      ));

      const architectureResponse = await apiServices.callOpenRouterArchitect(userRequest);
      let architectureJson = architectureResponse;
      try {
        const parsed = apiServices.parseArchitectureJSON(architectureResponse);
        architectureJson = JSON.stringify(parsed, null, 2);
      } catch (error) {
        console.error('Failed to parse architecture JSON:', error);
      }
      setArchitectureJson(architectureJson);

      setCurrentSteps(prev => prev.map((step, index) =>
        index === 0 ? { ...step, status: 'completed', content: architectureJson } : step
      ));

      // Step 2: Implement Functions
      setCurrentSteps(prev => prev.map((step, index) => 
        index === 1 ? { ...step, status: 'loading' } : step
      ));

      const implementedFunctions = await apiServices.implementFunctionsFromJSON(architectureJson, userRequest);

      setCurrentSteps(prev => prev.map((step, index) => 
        index === 1 ? { ...step, status: 'completed', content: `Implemented ${implementedFunctions.length} functions` } : step
      ));

      // Step 3: Build Contract
      setCurrentSteps(prev => prev.map((step, index) => 
        index === 2 ? { ...step, status: 'loading' } : step
      ));

      const finalContract = apiServices.aggregateContract(implementedFunctions, userRequest);

      setCurrentSteps(prev => prev.map((step, index) => 
        index === 2 ? { ...step, status: 'completed', content: finalContract } : step
      ));

      // Step 4: Compile Contract
      setCurrentSteps(prev => prev.map((step, index) => 
        index === 3 ? { ...step, status: 'loading' } : step
      ));

      const compilationResult = await apiServices.compileSolidityContract(finalContract);

      setCurrentSteps(prev => prev.map((step, index) => 
        index === 3 ? { ...step, status: 'completed', content: compilationResult } : step
      ));

      // Step 5: Display Results
      setCurrentSteps(prev => prev.map((step, index) => 
        index === 4 ? { ...step, status: 'completed' } : step
      ));

      const successResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `✅ **Smart Contract Generated Successfully!**

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

  const MarkdownRenderer = ({ content }: { content: string }) => {
    const [isCodeExpanded, setIsCodeExpanded] = useState(false);

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const codeString = String(children).trim();
            if (inline) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <Collapsible open={isCodeExpanded} onOpenChange={setIsCodeExpanded}>
                <div className="flex items-center justify-between bg-muted px-3 py-2 rounded-t">
                  <CollapsibleTrigger className="flex items-center space-x-1 text-xs font-medium">
                    <span>Smart Contract Code</span>
                    {isCodeExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </CollapsibleTrigger>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-1"
                    onClick={() => copyToClipboard(codeString)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <CollapsibleContent>
                  <pre
                    className={`${className} p-3 bg-muted rounded-b overflow-x-auto text-xs`}
                  >
                    <code {...props}>{children}</code>
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  const getStepIcon = (status: GenerationStep['status'], stepId: string) => {
    const iconMap = {
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
                  
                   <Card className="p-4 bg-gradient-card border-border/50 relative">
                     <div className="prose prose-sm max-w-none dark:prose-invert [&>pre]:bg-muted [&>pre]:p-3 [&>pre]:rounded [&>pre]:overflow-x-auto [&>code]:bg-muted [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-sm [&>pre>code]:text-xs [&>pre]:text-xs">
                       <MarkdownRenderer content={message.content} />
                     </div>

                     {message.role === 'assistant' && (
                       <div className="flex justify-end mt-3 space-x-2">
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => copyToClipboard(message.content)}
                           className="text-xs"
                         >
                           <Copy className="h-3 w-3 mr-1" />
                           Copy All
                         </Button>
                       </div>
                     )}
                   </Card>
                </div>
              </div>
            ))}

            {/* Architecture JSON Display */}
            {architectureJson && (
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
                  <Brain className="h-4 w-4 text-white" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-sm font-medium text-foreground">Contract Architecture</span>
                    <Badge variant="success" className="text-xs">Generated</Badge>
                  </div>
                  
                  <Card className="bg-gradient-card border-border/50">
                    <Collapsible open={isArchitectureExpanded} onOpenChange={setIsArchitectureExpanded}>
                      <CollapsibleTrigger className="w-full p-4 text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">📋 Contract Architecture</span>
                            <span className="text-xs text-muted-foreground">(Click to expand)</span>
                          </div>
                          {isArchitectureExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4">
                          <div className="bg-muted rounded-lg p-3 overflow-x-auto">
                            <pre className="text-xs text-foreground whitespace-pre-wrap">
                              {architectureJson ? formatJSON(architectureJson) : ''}
                            </pre>
                          </div>
                          <div className="flex justify-end mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(architectureJson)}
                              className="text-xs"
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy JSON
                            </Button>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                </div>
              </div>
            )}

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
            {!hasAPIKeys() && (
              <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                <div className="flex items-center space-x-2 text-warning-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">API Key Required</span>
                </div>
                <p className="text-xs text-warning-foreground/80 mt-1">
                  Configure your OpenRouter API key to start generating smart contracts.
                </p>
              </div>
            )}
            <div className="flex items-end space-x-3">
              <div className="flex-1">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={hasAPIKeys() ? "Describe the smart contract you want to create..." : "Configure your API key first..."}
                  disabled={isGenerating || !hasAPIKeys()}
                  className="min-h-[2.5rem] resize-none"
                />
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={isGenerating || !inputValue.trim() || !hasAPIKeys()}
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