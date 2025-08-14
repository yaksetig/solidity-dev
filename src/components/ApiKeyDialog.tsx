import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Key, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { APIServices } from "@/services/apiServices";
import { saveAPIKeys, loadAPIKeys, clearAPIKeys } from "@/utils/storage";

interface ApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onKeysConfigured: (apiServices: APIServices) => void;
}

const ApiKeyDialog = ({ open, onClose, onKeysConfigured }: ApiKeyDialogProps) => {
  const [perplexityKey, setPerplexityKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [isTestingConnections, setIsTestingConnections] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    perplexity: boolean | null;
    openrouter: boolean | null;
  }>({ perplexity: null, openrouter: null });

  const handleLoadSavedKeys = () => {
    const savedKeys = loadAPIKeys();
    if (savedKeys) {
      setPerplexityKey(savedKeys.perplexity);
      setOpenrouterKey(savedKeys.openrouter);
      toast.success("Loaded saved API keys");
    } else {
      toast.error("No saved API keys found");
    }
  };

  const handleTestConnections = async () => {
    if (!perplexityKey.trim() || !openrouterKey.trim()) {
      toast.error("Please enter both API keys");
      return;
    }

    setIsTestingConnections(true);
    setConnectionStatus({ perplexity: null, openrouter: null });

    try {
      const apiServices = new APIServices(perplexityKey.trim(), openrouterKey.trim());
      const results = await apiServices.testApiConnections();
      
      setConnectionStatus(results);
      
      if (results.perplexity && results.openrouter) {
        toast.success("Both API connections successful!");
      } else {
        toast.error("One or more API connections failed");
      }
    } catch (error) {
      toast.error("Failed to test API connections");
      console.error("Connection test error:", error);
    } finally {
      setIsTestingConnections(false);
    }
  };

  const handleSaveAndContinue = () => {
    if (!perplexityKey.trim() || !openrouterKey.trim()) {
      toast.error("Please enter both API keys");
      return;
    }

    const keys = {
      perplexity: perplexityKey.trim(),
      openrouter: openrouterKey.trim()
    };

    saveAPIKeys(keys);
    const apiServices = new APIServices(keys.perplexity, keys.openrouter);
    onKeysConfigured(apiServices);
    onClose();
    toast.success("API keys saved and configured!");
  };

  const handleClearKeys = () => {
    clearAPIKeys();
    setPerplexityKey("");
    setOpenrouterKey("");
    setConnectionStatus({ perplexity: null, openrouter: null });
    toast.success("API keys cleared");
  };

  const getStatusBadge = (status: boolean | null) => {
    if (status === null) return <Badge variant="secondary">Not tested</Badge>;
    if (status) return <Badge variant="default" className="bg-success text-success-foreground">Connected</Badge>;
    return <Badge variant="destructive">Failed</Badge>;
  };

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return <Key className="h-4 w-4 text-muted-foreground" />;
    if (status) return <CheckCircle className="h-4 w-4 text-success" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gradient-card border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-foreground">
            <Key className="h-5 w-5 text-primary" />
            <span>Configure API Keys</span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter your Perplexity and OpenRouter API keys to enable real trading strategy generation.
            Keys are stored securely in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Perplexity API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="perplexity-key" className="text-foreground">Perplexity API Key</Label>
              <div className="flex items-center space-x-2">
                {getStatusIcon(connectionStatus.perplexity)}
                {getStatusBadge(connectionStatus.perplexity)}
              </div>
            </div>
            <Input
              id="perplexity-key"
              type="password"
              placeholder="pplx-..."
              value={perplexityKey}
              onChange={(e) => setPerplexityKey(e.target.value)}
              className="bg-input border-border text-foreground"
            />
          </div>

          {/* OpenRouter API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="openrouter-key" className="text-foreground">OpenRouter API Key</Label>
              <div className="flex items-center space-x-2">
                {getStatusIcon(connectionStatus.openrouter)}
                {getStatusBadge(connectionStatus.openrouter)}
              </div>
            </div>
            <Input
              id="openrouter-key"
              type="password"
              placeholder="sk-or-..."
              value={openrouterKey}
              onChange={(e) => setOpenrouterKey(e.target.value)}
              className="bg-input border-border text-foreground"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-2">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={handleLoadSavedKeys}
                className="flex-1"
              >
                Load Saved Keys
              </Button>
              <Button
                variant="outline"
                onClick={handleTestConnections}
                disabled={isTestingConnections || !perplexityKey.trim() || !openrouterKey.trim()}
                className="flex-1"
              >
                {isTestingConnections ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Test Connections"
                )}
              </Button>
            </div>
            
            <Button
              onClick={handleSaveAndContinue}
              disabled={!perplexityKey.trim() || !openrouterKey.trim()}
              className="w-full"
            >
              Save & Continue
            </Button>
            
            <Button
              variant="outline"
              onClick={handleClearKeys}
              className="w-full text-destructive hover:text-destructive"
            >
              Clear Stored Keys
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Get Perplexity API key at: api.perplexity.ai</p>
          <p>• Get OpenRouter API key at: openrouter.ai</p>
          <p>• Keys are encrypted and stored locally in your browser</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApiKeyDialog;