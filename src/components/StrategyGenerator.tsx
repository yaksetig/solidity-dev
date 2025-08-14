import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Loader2, Play, Code, CheckCircle, AlertCircle, Settings, Brain, Zap, TestTube, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import ApiKeyDialog from "@/components/ApiKeyDialog";
import { APIServices } from "@/services/apiServices";
import { hasAPIKeys, loadAPIKeys } from "@/utils/storage";

interface GenerationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  content?: string;
}

const CRYPTO_ASSETS = [
  { value: 'BTC', label: 'Bitcoin (BTC)' },
  { value: 'ETH', label: 'Ethereum (ETH)' },
  { value: 'SOL', label: 'Solana (SOL)' },
  { value: 'ADA', label: 'Cardano (ADA)' },
  { value: 'MATIC', label: 'Polygon (MATIC)' },
  { value: 'DOT', label: 'Polkadot (DOT)' },
  { value: 'LINK', label: 'Chainlink (LINK)' },
  { value: 'AVAX', label: 'Avalanche (AVAX)' },
];

const StrategyGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [apiServices, setApiServices] = useState<APIServices | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string>('BTC');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [steps, setSteps] = useState<GenerationStep[]>([
    {
      id: 'strategy',
      title: 'Generate Trading Strategy',
      description: 'AI creates a pure trading strategy focusing on market analysis and logic (no code)',
      status: 'pending'
    },
    {
      id: 'architecture',
      title: 'Generate Architecture',
      description: 'Convert strategy into structured JSON with function signatures and dependencies',
      status: 'pending'
    },
    {
      id: 'implementation',
      title: 'Implement Functions',
      description: 'AI implements each function individually from the JSON architecture',
      status: 'pending'
    },
    {
      id: 'aggregation',
      title: 'Build Final Code',
      description: 'Combine all implemented functions into single Python file with backtesting engine',
      status: 'pending'
    },
    {
      id: 'validation',
      title: 'Code Quality Check',
      description: 'Validate code structure and native library usage',
      status: 'pending'
    },
    {
      id: 'execution',
      title: 'Railway API Test',
      description: 'Test code execution on Railway Python API',
      status: 'pending'
    }
  ]);

  const handleGenerateStrategy = async () => {
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
        setShowApiKeyDialog(true);
        return;
      } else {
        setShowApiKeyDialog(true);
        return;
      }
    }

    setIsGenerating(true);
    toast.success("Starting real strategy generation...");
    
    await generateRealStrategy();
  };

  const generateRealStrategy = async () => {
    if (!apiServices) return;

    // Reset all steps
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', content: undefined })));

    try {
      // Step 1: Strategy Generation with Perplexity
      setSteps(prev => prev.map((step, index) => 
        index === 0 ? { ...step, status: 'loading' } : step
      ));

      const strategy = await apiServices.callPerplexityAPI(
        selectedAsset,
        `Create a detailed algorithmic trading strategy focused on ${selectedAsset} cryptocurrency using 4-hour intervals. Include momentum indicators, volatility analysis, and risk management specific to crypto markets.`
      );

      setSteps(prev => prev.map((step, index) => 
        index === 0 ? { ...step, status: 'completed', content: strategy } : step
      ));

      // Step 2: JSON Architecture Generation
      setSteps(prev => prev.map((step, index) => 
        index === 1 ? { ...step, status: 'loading' } : step
      ));

      const architectureJson = await apiServices.callOpenRouterArchitect(strategy);

      setSteps(prev => prev.map((step, index) => 
        index === 1 ? { ...step, status: 'completed', content: architectureJson } : step
      ));

      // Step 3: Implement Functions Directly from JSON
      setSteps(prev => prev.map((step, index) => 
        index === 2 ? { ...step, status: 'loading' } : step
      ));

      const implementedFunctions = await apiServices.implementFunctionsFromJSON(architectureJson, strategy);

      const implementationContent = `✅ Function implementation completed!\n\nImplemented ${implementedFunctions.length} functions:\n${implementedFunctions.map(f => `• ${f.name}`).join('\n')}`;
      
      setSteps(prev => prev.map((step, index) => 
        index === 2 ? { ...step, status: 'completed', content: implementationContent } : step
      ));

      // Step 4: Build Final Code
      setSteps(prev => prev.map((step, index) => 
        index === 3 ? { ...step, status: 'loading' } : step
      ));

      const finalCode = apiServices.aggregateCode(implementedFunctions, strategy);

      setSteps(prev => prev.map((step, index) => 
        index === 3 ? { ...step, status: 'completed', content: finalCode } : step
      ));

      // Step 5: Code Quality Check
      setSteps(prev => prev.map((step, index) => 
        index === 4 ? { ...step, status: 'loading' } : step
      ));

      const validation = apiServices.validateCode(finalCode);

      setSteps(prev => prev.map((step, index) => 
        index === 4 ? { ...step, status: 'completed', content: validation } : step
      ));

      // Step 6: Railway API Test
      setSteps(prev => prev.map((step, index) => 
        index === 5 ? { ...step, status: 'loading' } : step
      ));

      const executionResult = await apiServices.validateWithRailwayAPI(finalCode);

      setSteps(prev => prev.map((step, index) => 
        index === 5 ? { ...step, status: 'completed', content: executionResult } : step
      ));

      setIsGenerating(false);
      toast.success("Strategy generation completed!");

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Mark current loading step as error
      setSteps(prev => prev.map(step => 
        step.status === 'loading' ? { ...step, status: 'error', content: `Error: ${errorMessage}` } : step
      ));

      setIsGenerating(false);
      toast.error(`Strategy generation failed: ${errorMessage}`);
    }
  };

  const handleApiKeysConfigured = (configuredApiServices: APIServices) => {
    setApiServices(configuredApiServices);
    // Automatically start generation after keys are configured
    setTimeout(() => {
      generateRealStrategy();
    }, 500);
  };

  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const getContentTypeLabel = (stepId: string) => {
    const labels = {
      strategy: 'Trading Strategy',
      architecture: 'JSON Architecture',
      implementation: 'Implementation Results',
      aggregation: 'Final Python Code',
      validation: 'Validation Results',
      execution: 'Execution Results'
    };
    return labels[stepId as keyof typeof labels] || 'Content';
  };

  const getStepIcon = (status: GenerationStep['status'], stepId: string) => {
    const iconMap = {
      strategy: Brain,
      architecture: Zap,
      implementation: Code,
      aggregation: CheckCircle,
      validation: TestTube,
      execution: CheckCircle2
    };
    
    const IconComponent = iconMap[stepId as keyof typeof iconMap] || Code;
    
    switch (status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <IconComponent className="h-4 w-4 text-success" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <IconComponent className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-glow">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center space-x-2 bg-card/80 backdrop-blur-sm rounded-full px-4 py-2 border">
              <Code className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">AI-Powered Trading Strategy Generator</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Single-File Crypto Strategies
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Generate complete crypto trading strategies in a single Python file. 4-hour intervals, native libraries only.
            </p>
            
            <div className="flex flex-col items-center space-y-6">
              <div className="flex items-center space-x-4">
                <label htmlFor="asset-select" className="text-sm font-medium text-foreground">
                  Select Cryptocurrency:
                </label>
                <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Choose asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {CRYPTO_ASSETS.map((asset) => (
                      <SelectItem key={asset.value} value={asset.value}>
                        {asset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                <Button 
                  variant="hero" 
                  size="lg"
                  onClick={handleGenerateStrategy}
                  disabled={isGenerating}
                  className="group"
                >
                  <Play className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                  Generate {selectedAsset} Strategy
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => setShowApiKeyDialog(true)}
                  className="group border-primary/20 text-primary hover:bg-primary/10"
                >
                  <Settings className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform" />
                  Configure API Keys
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generation Steps */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-6">
          {steps.map((step, index) => (
            <Card key={step.id} className="p-6 bg-gradient-card border-border/50 shadow-card animate-slide-up">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  {getStepIcon(step.status, step.id)}
                </div>
                
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {step.title}
                      </h3>
                      <p className="text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                    
                    <Badge 
                      variant={
                        step.status === 'completed' ? 'success' : 
                        step.status === 'loading' ? 'warning' :
                        step.status === 'error' ? 'destructive' : 'secondary'
                      }
                    >
                      {step.status}
                    </Badge>
                  </div>
                  
                   {step.content && (
                     <Collapsible>
                       <CollapsibleTrigger asChild>
                         <Button
                           variant="ghost"
                           className="w-full justify-between p-3 h-auto bg-muted/30 hover:bg-muted/50 border border-border/30 rounded-lg"
                           onClick={() => toggleStepExpansion(step.id)}
                         >
                           <div className="flex items-center space-x-2">
                             <span className="text-sm font-medium">
                               View {getContentTypeLabel(step.id)}
                             </span>
                             <Badge variant="outline" className="text-xs">
                               {step.content.length > 1000 ? `${Math.round(step.content.length / 1000)}k chars` : `${step.content.length} chars`}
                             </Badge>
                           </div>
                           {expandedSteps.has(step.id) ? (
                             <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                           ) : (
                             <ChevronRight className="h-4 w-4 transition-transform duration-200" />
                           )}
                         </Button>
                       </CollapsibleTrigger>
                       <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                         <div className="bg-muted/50 rounded-lg p-4 border mt-3">
                           <div className="flex justify-between items-center mb-2">
                             <span className="text-xs text-muted-foreground font-medium">
                               {getContentTypeLabel(step.id)}
                             </span>
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => navigator.clipboard.writeText(step.content || '')}
                               className="text-xs"
                             >
                               Copy {step.id === 'coding' ? 'Python Code' : 'Content'}
                             </Button>
                           </div>
                            <div className="prose prose-sm max-w-none dark:prose-invert [&>pre]:bg-muted [&>pre]:p-3 [&>pre]:rounded [&>pre]:overflow-x-auto [&>code]:bg-muted [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-sm">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeHighlight]}
                              >
                                {step.content}
                              </ReactMarkdown>
                            </div>
                         </div>
                       </CollapsibleContent>
                     </Collapsible>
                   )}
                </div>
              </div>
            </Card>
          ))}
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

export default StrategyGenerator;