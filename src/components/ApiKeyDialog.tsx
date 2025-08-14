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
  const [nvidiaKey, setNvidiaKey] = useState("");
  const [isTestingConnections, setIsTestingConnections] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    perplexity: boolean | null;
    nvidia: boolean | null;
  }>({ perplexity: null, nvidia: null });

  const handleLoadSavedKeys = () => {
    const savedKeys = loadAPIKeys();
    if (savedKeys) {
      setPerplexityKey(savedKeys.perplexity);
      setNvidiaKey(savedKeys.nvidia);
      toast.success("Loaded saved API keys");
    } else {
      toast.error("No saved API keys found");
    }
  };

  const handleTestConnections = async () => {
    if (!perplexityKey.trim() || !nvidiaKey.trim()) {
      toast.error("Please enter both API keys");
      return;
    }

    setIsTestingConnections(true);
    setConnectionStatus({ perplexity: null, nvidia: null });

    try {
      const apiServices = new APIServices(perplexityKey.trim(), nvidiaKey.trim());
      const results = await apiServices.testApiConnections();
      
      setConnectionStatus(results);
      
      if (results.perplexity && results.nvidia) {
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
    if (!perplexityKey.trim() || !nvidiaKey.trim()) {
      toast.error("Please enter both API keys");
      return;
    }

    const keys = {
      perplexity: perplexityKey.trim(),
      nvidia: nvidiaKey.trim()
    };

    saveAPIKeys(keys);
    const apiServices = new APIServices(keys.perplexity, keys.nvidia);
    onKeysConfigured(apiServices);
    onClose();
    toast.success("API keys saved and configured!");
  };

  const handleClearKeys = () => {
    clearAPIKeys();
    setPerplexityKey("");
    setNvidiaKey("");
    setConnectionStatus({ perplexity: null, nvidia: null });
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
            Enter your Perplexity and NVIDIA API keys to enable real trading strategy generation.
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

          {/* NVIDIA API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="nvidia-key" className="text-foreground">NVIDIA API Key</Label>
              <div className="flex items-center space-x-2">
                {getStatusIcon(connectionStatus.nvidia)}
                {getStatusBadge(connectionStatus.nvidia)}
              </div>
            </div>
            <Input
              id="nvidia-key"
              type="password"
              placeholder="nvapi-..."
              value={nvidiaKey}
              onChange={(e) => setNvidiaKey(e.target.value)}
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
                disabled={isTestingConnections || !perplexityKey.trim() || !nvidiaKey.trim()}
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
              disabled={!perplexityKey.trim() || !nvidiaKey.trim()}
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
          <p>• Get NVIDIA API key at: build.nvidia.com</p>
          <p>• Keys are encrypted and stored locally in your browser</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApiKeyDialog;