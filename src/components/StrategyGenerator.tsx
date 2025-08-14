import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Code, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface GenerationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  content?: string;
}

const StrategyGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [steps, setSteps] = useState<GenerationStep[]>([
    {
      id: 'strategy',
      title: 'Strategy Generation',
      description: 'Creating algorithmic trading strategy using Perplexity AI',
      status: 'pending'
    },
    {
      id: 'planning',
      title: 'Implementation Planning',
      description: 'Generating Python architecture plan with NVIDIA AI',
      status: 'pending'
    },
    {
      id: 'coding',
      title: 'Code Generation',
      description: 'Creating Python implementation with NVIDIA GPT-OSS',
      status: 'pending'
    },
    {
      id: 'testing',
      title: 'Code Testing',
      description: 'Validating generated code functionality',
      status: 'pending'
    }
  ]);

  const handleGenerateStrategy = async () => {
    setIsGenerating(true);
    toast.success("Starting strategy generation...");
    
    // For now, simulate the workflow
    simulateGeneration();
  };

  const simulateGeneration = async () => {
    const delays = [2000, 3000, 4000, 2500];
    
    for (let i = 0; i < steps.length; i++) {
      // Set current step to loading
      setSteps(prev => prev.map((step, index) => 
        index === i ? { ...step, status: 'loading' } : step
      ));
      
      await new Promise(resolve => setTimeout(resolve, delays[i]));
      
      // Set current step to completed with mock content
      setSteps(prev => prev.map((step, index) => 
        index === i ? { 
          ...step, 
          status: 'completed',
          content: getMockContent(step.id)
        } : step
      ));
    }
    
    setIsGenerating(false);
    toast.success("Strategy generation completed!");
  };

  const getMockContent = (stepId: string): string => {
    const mockContents = {
      strategy: "Mean Reversion Strategy using Binance spot data and DeFiLlama TVL metrics. The strategy identifies oversold conditions in major cryptocurrencies when TVL in related DeFi protocols shows divergence.",
      planning: "1. Set up Binance API client\n2. Integrate DeFiLlama API\n3. Implement moving average calculations\n4. Create signal generation logic\n5. Add risk management\n6. Setup backtesting framework",
      coding: "```python\nimport ccxt\nimport requests\nimport pandas as pd\nimport numpy as np\n\nclass MeanReversionStrategy:\n    def __init__(self, api_key, secret):\n        self.exchange = ccxt.binance({\n            'apiKey': api_key,\n            'secret': secret,\n            'sandbox': True\n        })\n        \n    def get_tvl_data(self, protocol):\n        url = f'https://api.llama.fi/protocol/{protocol}'\n        response = requests.get(url)\n        return response.json()\n```",
      testing: "✅ Code compilation successful\n✅ API connections validated\n✅ Strategy logic verified\n⚠️ Backtesting recommended before live trading"
    };
    return mockContents[stepId as keyof typeof mockContents] || "Content generated";
  };

  const getStepIcon = (status: GenerationStep['status']) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-muted" />;
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
              Generate Trading Strategies
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Create algorithmic trading strategies using AI. From concept to implementation in minutes.
            </p>
            
            <Button 
              variant="hero" 
              size="lg"
              onClick={handleGenerateStrategy}
              disabled={isGenerating}
              className="group"
            >
              <Play className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
              Create New Trading Strategy
            </Button>
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
                  {getStepIcon(step.status)}
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
                    <div className="bg-muted/50 rounded-lg p-4 border">
                      <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
                        {step.content}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StrategyGenerator;